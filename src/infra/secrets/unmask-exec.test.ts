import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makePlaceholder } from "./masker.js";
import { SecretsRegistry } from "./registry.js";
import { unmaskForExecution } from "./unmask-exec.js";

describe("unmaskForExecution", () => {
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
  // Simple string unmasking
  // -------------------------------------------------------------------------

  describe("simple string", () => {
    it("unmasks a placeholder in a plain string", () => {
      const secret = "sk-abc123XYZ";
      const registry = createRegistryWithSecret("key", secret);
      const placeholder = makePlaceholder(secret);

      const result = unmaskForExecution(`curl -H "Authorization: Bearer ${placeholder}"`, registry);
      expect(result).toBe(`curl -H "Authorization: Bearer ${secret}"`);
    });

    it("returns the string unchanged when no placeholders present", () => {
      const registry = createRegistryWithSecret("key", "mysecret1");
      const result = unmaskForExecution("echo hello", registry);
      expect(result).toBe("echo hello");
    });
  });

  // -------------------------------------------------------------------------
  // Deep object walk
  // -------------------------------------------------------------------------

  describe("deep object walk", () => {
    it("unmasks nested object properties", () => {
      const secret = "ghp_nestedtoken";
      const registry = createRegistryWithSecret("token", secret);
      const placeholder = makePlaceholder(secret);

      const args = {
        command: `git clone https://${placeholder}@github.com/repo.git`,
        options: {
          env: {
            GH_TOKEN: placeholder,
          },
        },
      };

      const result = unmaskForExecution(args, registry) as typeof args;
      expect(result.command).toBe(`git clone https://${secret}@github.com/repo.git`);
      expect(result.options.env.GH_TOKEN).toBe(secret);
    });

    it("preserves non-string primitives", () => {
      const registry = createRegistryWithSecret("key", "somesecret");
      const args = {
        timeout: 5000,
        retries: 3,
        verbose: true,
        data: null,
      };

      const result = unmaskForExecution(args, registry) as typeof args;
      expect(result.timeout).toBe(5000);
      expect(result.retries).toBe(3);
      expect(result.verbose).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Array arguments
  // -------------------------------------------------------------------------

  describe("arrays", () => {
    it("unmasks strings inside arrays", () => {
      const secret = "array-secret1";
      const registry = createRegistryWithSecret("key", secret);
      const placeholder = makePlaceholder(secret);

      const args = {
        commands: [`echo ${placeholder}`, "echo safe", `export KEY=${placeholder}`],
      };

      const result = unmaskForExecution(args, registry) as typeof args;
      expect(result.commands[0]).toBe(`echo ${secret}`);
      expect(result.commands[1]).toBe("echo safe");
      expect(result.commands[2]).toBe(`export KEY=${secret}`);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed masked/unmasked content
  // -------------------------------------------------------------------------

  describe("mixed content", () => {
    it("handles a mix of masked and plain values", () => {
      const secret1 = "first-secret1";
      const secret2 = "second-secret";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("a", secret1);
      registry.register("b", secret2);
      const ph1 = makePlaceholder(secret1);
      const ph2 = makePlaceholder(secret2);

      const args = {
        url: `https://api.example.com/v1`,
        headers: {
          Authorization: `Bearer ${ph1}`,
          "X-API-Key": ph2,
          "Content-Type": "application/json",
        },
      };

      const result = unmaskForExecution(args, registry) as typeof args;
      expect(result.url).toBe("https://api.example.com/v1");
      expect(result.headers.Authorization).toBe(`Bearer ${secret1}`);
      expect(result.headers["X-API-Key"]).toBe(secret2);
      expect(result.headers["Content-Type"]).toBe("application/json");
    });
  });

  // -------------------------------------------------------------------------
  // No-op behavior
  // -------------------------------------------------------------------------

  describe("no-op", () => {
    it("returns args unchanged when registry is empty", () => {
      const registry = SecretsRegistry.getInstance();
      const args = { command: "echo test", value: 42 };

      const result = unmaskForExecution(args, registry);
      // Should return the same reference when no-op
      expect(result).toBe(args);
    });

    it("passes null through unchanged", () => {
      const registry = createRegistryWithSecret("key", "somesecret");
      expect(unmaskForExecution(null, registry)).toBeNull();
    });

    it("passes undefined through unchanged", () => {
      const registry = createRegistryWithSecret("key", "somesecret");
      expect(unmaskForExecution(undefined, registry)).toBeUndefined();
    });

    it("passes numbers through unchanged", () => {
      const registry = createRegistryWithSecret("key", "somesecret");
      expect(unmaskForExecution(42, registry)).toBe(42);
    });

    it("passes booleans through unchanged", () => {
      const registry = createRegistryWithSecret("key", "somesecret");
      expect(unmaskForExecution(true, registry)).toBe(true);
    });
  });
});
