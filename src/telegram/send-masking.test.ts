import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makePlaceholder } from "../infra/secrets/masker.js";
import { SecretsRegistry } from "../infra/secrets/registry.js";

// We test that formatErrorMessage and formatUncaughtError apply masking.
// The send.ts functions are too integration-heavy (need Grammy, config, network)
// to unit test the Telegram send pipeline directly. Instead we verify the
// masking call sites:
// 1. formatErrorMessage() in errors.ts (shared by send.ts fallback paths)
// 2. formatUncaughtError() in errors.ts (used by http logger in send.ts)
import { formatErrorMessage, formatUncaughtError } from "../infra/errors.js";

describe("Telegram send masking (via error formatters)", () => {
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
    it("formatErrorMessage returns message unchanged when registry is empty", () => {
      SecretsRegistry.getInstance();
      const err = new Error("Something went wrong");

      expect(formatErrorMessage(err)).toBe("Something went wrong");
    });

    it("formatUncaughtError returns stack unchanged when registry is empty", () => {
      SecretsRegistry.getInstance();
      const err = new Error("Something went wrong");

      const result = formatUncaughtError(err);
      expect(result).toContain("Something went wrong");
    });
  });

  // ---------------------------------------------------------------------------
  // formatErrorMessage masks secrets
  // ---------------------------------------------------------------------------

  describe("formatErrorMessage masking", () => {
    it("masks a secret in Error.message", () => {
      const secret = "sk-test-abc123XYZ";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("api-key", secret);
      const placeholder = makePlaceholder(secret);

      const err = new Error(`API call failed: key=${secret}`);
      const result = formatErrorMessage(err);

      expect(result).toBe(`API call failed: key=${placeholder}`);
      expect(result).not.toContain(secret);
    });

    it("masks a secret in a string error", () => {
      const secret = "ghp_abcdefgh12345678";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("token", secret);
      const placeholder = makePlaceholder(secret);

      const result = formatErrorMessage(`Auth failed: ${secret}`);

      expect(result).toBe(`Auth failed: ${placeholder}`);
    });

    it("masks a secret in a JSON-serialized error object", () => {
      const secret = "database-password-xyz123";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("db-pass", secret);

      const errObj = { code: "DB_ERR", detail: `pass=${secret}` };
      const result = formatErrorMessage(errObj);

      expect(result).not.toContain(secret);
      expect(result).toContain(makePlaceholder(secret));
    });
  });

  // ---------------------------------------------------------------------------
  // formatUncaughtError masks secrets in stack traces
  // ---------------------------------------------------------------------------

  describe("formatUncaughtError masking", () => {
    it("masks a secret in error stack trace", () => {
      const secret = "super-secret-token-value";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("token", secret);

      const err = new Error(`connection to ${secret}@host failed`);
      const result = formatUncaughtError(err);

      expect(result).not.toContain(secret);
      expect(result).toContain(makePlaceholder(secret));
    });

    it("returns formatErrorMessage for INVALID_CONFIG errors (still masked)", () => {
      const secret = "config-secret-value-abc";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("cfg", secret);

      const err = new Error(`Invalid config: ${secret}`);
      (err as unknown as { code: string }).code = "INVALID_CONFIG";

      const result = formatUncaughtError(err);

      expect(result).not.toContain(secret);
      expect(result).toContain(makePlaceholder(secret));
    });
  });
});
