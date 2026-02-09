import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makePlaceholder } from "./masker.js";
import { SecretsRegistry } from "./registry.js";
import { maskErrorOutput } from "./error-masking.js";

describe("maskErrorOutput", () => {
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
    it("returns input unchanged when registry is empty", () => {
      SecretsRegistry.getInstance();
      const input = "Error: connection refused at 127.0.0.1:5432";

      const result = maskErrorOutput(input);

      expect(result).toBe(input);
    });
  });

  // ---------------------------------------------------------------------------
  // Error.message with secret
  // ---------------------------------------------------------------------------

  describe("error message masking", () => {
    it("masks a secret in an error message string", () => {
      const secret = "sk-test-abc123XYZ";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("api-key", secret);
      const placeholder = makePlaceholder(secret);

      const result = maskErrorOutput(`API call failed: key=${secret}`);

      expect(result).toBe(`API call failed: key=${placeholder}`);
      expect(result).not.toContain(secret);
    });
  });

  // ---------------------------------------------------------------------------
  // Stack trace with secret
  // ---------------------------------------------------------------------------

  describe("stack trace masking", () => {
    it("masks a secret embedded in a stack trace", () => {
      const secret = "database-password-xyz123";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("db-pass", secret);
      const placeholder = makePlaceholder(secret);

      const stackTrace = [
        `Error: connection failed to postgres://user:${secret}@host:5432/db`,
        "    at connect (/app/src/db.ts:42:7)",
        "    at main (/app/src/index.ts:10:3)",
      ].join("\n");

      const result = maskErrorOutput(stackTrace);

      expect(result).not.toContain(secret);
      expect(result).toContain(placeholder);
      expect(result).toContain("at connect");
    });
  });

  // ---------------------------------------------------------------------------
  // JSON-serialized error with secret
  // ---------------------------------------------------------------------------

  describe("JSON error masking", () => {
    it("masks a secret in a JSON-serialized error", () => {
      const secret = "ghp_abcdefgh12345678";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("token", secret);
      const placeholder = makePlaceholder(secret);

      const jsonError = JSON.stringify({
        error: "auth_failed",
        details: `Invalid token: ${secret}`,
      });

      const result = maskErrorOutput(jsonError);

      expect(result).not.toContain(secret);
      expect(result).toContain(placeholder);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple secrets
  // ---------------------------------------------------------------------------

  describe("multiple secrets", () => {
    it("masks multiple secrets in a single error string", () => {
      const secret1 = "first-secret-value-abc";
      const secret2 = "second-secret-value-xyz";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key1", secret1);
      registry.register("key2", secret2);

      const result = maskErrorOutput(`Config error: key1=${secret1}, key2=${secret2}`);

      expect(result).not.toContain(secret1);
      expect(result).not.toContain(secret2);
      expect(result).toContain(makePlaceholder(secret1));
      expect(result).toContain(makePlaceholder(secret2));
    });
  });
});
