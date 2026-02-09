import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AgentMessage } from "@mariozechner/pi-agent-core";

import { makePlaceholder } from "./masker.js";
import { SecretsRegistry } from "./registry.js";
import { maskToolResultMessage } from "./tool-result-masking.js";

describe("maskToolResultMessage", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  // ---------------------------------------------------------------------------
  // No-op when registry is empty
  // ---------------------------------------------------------------------------

  describe("no-op", () => {
    it("returns message unchanged when registry is empty", () => {
      SecretsRegistry.getInstance();
      const message = {
        role: "toolResult",
        content: [{ type: "text", text: "some output" }],
      } as unknown as AgentMessage;

      const result = maskToolResultMessage(message);

      expect(result).toBe(message);
    });
  });

  // ---------------------------------------------------------------------------
  // String content masking
  // ---------------------------------------------------------------------------

  describe("string content", () => {
    it("masks a secret in text content", () => {
      const secret = "sk-test-abc123XYZ";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("api-key", secret);
      const placeholder = makePlaceholder(secret);

      const message = {
        role: "toolResult",
        content: [{ type: "text", text: `API key is ${secret}` }],
      } as unknown as AgentMessage;

      const result = maskToolResultMessage(message) as Record<string, unknown>;
      const content = result.content as Array<{ type: string; text: string }>;

      expect(content[0].text).toBe(`API key is ${placeholder}`);
      expect(content[0].text).not.toContain(secret);
    });

    it("masks multiple secrets in text content", () => {
      const secret1 = "sk-first-secret-value";
      const secret2 = "ghp_secondSecretValue123";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key1", secret1);
      registry.register("key2", secret2);

      const message = {
        role: "toolResult",
        content: [{ type: "text", text: `Keys: ${secret1} and ${secret2}` }],
      } as unknown as AgentMessage;

      const result = maskToolResultMessage(message) as Record<string, unknown>;
      const content = result.content as Array<{ type: string; text: string }>;

      expect(content[0].text).not.toContain(secret1);
      expect(content[0].text).not.toContain(secret2);
      expect(content[0].text).toContain(makePlaceholder(secret1));
      expect(content[0].text).toContain(makePlaceholder(secret2));
    });
  });

  // ---------------------------------------------------------------------------
  // Array content masking
  // ---------------------------------------------------------------------------

  describe("array content", () => {
    it("masks secrets in multiple content entries", () => {
      const secret = "database-password-xyz123";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("db-pass", secret);
      const placeholder = makePlaceholder(secret);

      const message = {
        role: "toolResult",
        content: [
          { type: "text", text: `password=${secret}` },
          { type: "text", text: "no secrets here" },
          { type: "text", text: `also ${secret}` },
        ],
      } as unknown as AgentMessage;

      const result = maskToolResultMessage(message) as Record<string, unknown>;
      const content = result.content as Array<{ type: string; text: string }>;

      expect(content[0].text).toBe(`password=${placeholder}`);
      expect(content[1].text).toBe("no secrets here");
      expect(content[2].text).toBe(`also ${placeholder}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Nested structures
  // ---------------------------------------------------------------------------

  describe("nested structures", () => {
    it("masks secrets in deeply nested content", () => {
      const secret = "super-secret-token-value";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("token", secret);
      const placeholder = makePlaceholder(secret);

      const message = {
        role: "toolResult",
        toolCallId: "call-1",
        content: [
          {
            type: "text",
            text: `Found token: ${secret}`,
          },
        ],
        metadata: {
          nested: {
            value: `token=${secret}`,
          },
        },
      } as unknown as AgentMessage;

      const result = maskToolResultMessage(message) as Record<string, unknown>;
      const content = result.content as Array<{ type: string; text: string }>;
      const metadata = result.metadata as { nested: { value: string } };

      expect(content[0].text).toBe(`Found token: ${placeholder}`);
      expect(metadata.nested.value).toBe(`token=${placeholder}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty content
  // ---------------------------------------------------------------------------

  describe("empty content", () => {
    it("handles empty content array", () => {
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", "some-secret-value");

      const message = {
        role: "toolResult",
        content: [],
      } as unknown as AgentMessage;

      const result = maskToolResultMessage(message) as Record<string, unknown>;
      const content = result.content as Array<unknown>;

      expect(content).toEqual([]);
    });

    it("handles message with no content", () => {
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", "some-secret-value");

      const message = {
        role: "toolResult",
      } as unknown as AgentMessage;

      const result = maskToolResultMessage(message);

      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Non-string values preserved
  // ---------------------------------------------------------------------------

  describe("non-string preservation", () => {
    it("preserves non-string values in the message", () => {
      const secret = "preserve-non-string-test";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", secret);

      const message = {
        role: "toolResult",
        content: [{ type: "text", text: `val=${secret}` }],
        numericField: 42,
        boolField: true,
        nullField: null,
      } as unknown as AgentMessage;

      const result = maskToolResultMessage(message) as Record<string, unknown>;

      expect(result.numericField).toBe(42);
      expect(result.boolField).toBe(true);
      expect(result.nullField).toBeNull();
    });
  });
});
