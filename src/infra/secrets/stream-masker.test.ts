import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makePlaceholder } from "./masker.js";
import { SecretsRegistry } from "./registry.js";
import { StreamMasker } from "./stream-masker.js";

describe("StreamMasker", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  function createRegistryWithSecret(name: string, value: string): SecretsRegistry {
    const registry = SecretsRegistry.getInstance({ minLength: 4 });
    registry.register(name, value);
    return registry;
  }

  // -------------------------------------------------------------------------
  // Single chunk masking
  // -------------------------------------------------------------------------

  describe("single chunk", () => {
    it("masks a secret fully contained in one chunk", () => {
      const secret = "sk-abc123XYZ";
      const registry = createRegistryWithSecret("key", secret);
      const masker = new StreamMasker(registry);
      const placeholder = makePlaceholder(secret);

      const output = masker.push(`Hello ${secret} world`);
      const flushed = masker.flush();

      expect(output + flushed).toBe(`Hello ${placeholder} world`);
      expect(output + flushed).not.toContain(secret);
    });

    it("returns chunk unchanged when registry is empty", () => {
      const registry = SecretsRegistry.getInstance();
      const masker = new StreamMasker(registry);

      const output = masker.push("no secrets here");
      expect(output).toBe("no secrets here");
    });
  });

  // -------------------------------------------------------------------------
  // Cross-boundary secret detection
  // -------------------------------------------------------------------------

  describe("cross-boundary", () => {
    it("detects a secret split across two chunks", () => {
      const secret = "sk-abc123XYZ";
      const registry = createRegistryWithSecret("key", secret);
      const masker = new StreamMasker(registry);
      const placeholder = makePlaceholder(secret);

      // Split the secret: "sk-abc1" | "23XYZ"
      const splitPoint = 7;
      const chunk1 = `before ${secret.slice(0, splitPoint)}`;
      const chunk2 = `${secret.slice(splitPoint)} after`;

      const out1 = masker.push(chunk1);
      const out2 = masker.push(chunk2);
      const flushed = masker.flush();

      const combined = out1 + out2 + flushed;
      expect(combined).toBe(`before ${placeholder} after`);
      expect(combined).not.toContain(secret);
    });

    it("detects a secret split across three chunks", () => {
      const secret = "supersecretvalue";
      const registry = createRegistryWithSecret("key", secret);
      const masker = new StreamMasker(registry);
      const placeholder = makePlaceholder(secret);

      const out1 = masker.push("start super");
      const out2 = masker.push("secret");
      const out3 = masker.push("value end");
      const flushed = masker.flush();

      const combined = out1 + out2 + out3 + flushed;
      expect(combined).toBe(`start ${placeholder} end`);
      expect(combined).not.toContain(secret);
    });

    it("handles secret at exact chunk boundary", () => {
      const secret = "ABCDEFGH";
      const registry = createRegistryWithSecret("key", secret);
      const masker = new StreamMasker(registry);
      const placeholder = makePlaceholder(secret);

      // Last char of chunk 1, first char of chunk 2
      const out1 = masker.push("prefix ABCDEFG");
      const out2 = masker.push("H suffix");
      const flushed = masker.flush();

      const combined = out1 + out2 + flushed;
      expect(combined).toBe(`prefix ${placeholder} suffix`);
    });
  });

  // -------------------------------------------------------------------------
  // Flush behavior
  // -------------------------------------------------------------------------

  describe("flush", () => {
    it("emits remaining buffer on flush", () => {
      const secret = "mysecretkey1";
      const registry = createRegistryWithSecret("key", secret);
      const masker = new StreamMasker(registry);

      const out = masker.push("safe text");
      const flushed = masker.flush();

      expect(out + flushed).toBe("safe text");
    });

    it("returns empty string when flushed without prior push", () => {
      const registry = createRegistryWithSecret("key", "somesecret");
      const masker = new StreamMasker(registry);

      const flushed = masker.flush();
      expect(flushed).toBe("");
    });

    it("returns empty string when registry is empty", () => {
      const registry = SecretsRegistry.getInstance();
      const masker = new StreamMasker(registry);

      masker.push("hello");
      const flushed = masker.flush();
      expect(flushed).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles empty chunks", () => {
      const registry = createRegistryWithSecret("key", "thesecret");
      const masker = new StreamMasker(registry);

      const out1 = masker.push("");
      const out2 = masker.push("hello");
      const out3 = masker.push("");
      const flushed = masker.flush();

      expect(out1 + out2 + out3 + flushed).toBe("hello");
    });

    it("handles chunks smaller than buffer size", () => {
      const secret = "a]long]secret]value]here";
      const registry = createRegistryWithSecret("key", secret);
      const masker = new StreamMasker(registry);

      // Push very small chunks
      const out1 = masker.push("x");
      const out2 = masker.push("y");
      const out3 = masker.push("z");
      const flushed = masker.flush();

      expect(out1 + out2 + out3 + flushed).toBe("xyz");
    });

    it("handles rapid successive pushes", () => {
      const secret = "rapidtoken";
      const registry = createRegistryWithSecret("key", secret);
      const masker = new StreamMasker(registry);
      const placeholder = makePlaceholder(secret);

      const parts = ["pre ", "rapi", "dtok", "en", " post"];
      const outputs: string[] = [];
      for (const part of parts) {
        outputs.push(masker.push(part));
      }
      outputs.push(masker.flush());

      const combined = outputs.join("");
      expect(combined).toBe(`pre ${placeholder} post`);
      expect(combined).not.toContain(secret);
    });

    it("handles multiple secrets in one stream", () => {
      const secret1 = "firstsecret1";
      const secret2 = "secondsecret";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("a", secret1);
      registry.register("b", secret2);
      const masker = new StreamMasker(registry);
      const ph1 = makePlaceholder(secret1);
      const ph2 = makePlaceholder(secret2);

      const out1 = masker.push(`begin ${secret1} mid`);
      const out2 = masker.push(`dle ${secret2} end`);
      const flushed = masker.flush();

      const combined = out1 + out2 + flushed;
      expect(combined).toBe(`begin ${ph1} middle ${ph2} end`);
    });
  });

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  describe("reset", () => {
    it("clears internal state for reuse", () => {
      const secret = "resetsecret!";
      const registry = createRegistryWithSecret("key", secret);
      const masker = new StreamMasker(registry);

      masker.push("some partial");
      masker.reset();

      // After reset, a new push should work independently
      const out = masker.push("clean text");
      const flushed = masker.flush();
      expect(out + flushed).toBe("clean text");
    });
  });
});
