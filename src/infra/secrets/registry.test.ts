import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makePlaceholder } from "./masker.js";
import { SecretsRegistry } from "./registry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up a controlled process.env for testing. */
function withEnv(env: Record<string, string>, fn: () => void): void {
  const original = { ...process.env };
  // Clear all env vars, then set only the test ones
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, env);
  try {
    fn();
  } finally {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, original);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("SecretsRegistry", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe("singleton lifecycle", () => {
    it("getInstance() returns the same instance", () => {
      const a = SecretsRegistry.getInstance();
      const b = SecretsRegistry.getInstance();
      expect(a).toBe(b);
    });

    it("reset() creates a new instance on next call", () => {
      const a = SecretsRegistry.getInstance();
      SecretsRegistry.reset();
      const b = SecretsRegistry.getInstance();
      expect(a).not.toBe(b);
    });

    it("new instance starts empty", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // register / unregister
  // -------------------------------------------------------------------------

  describe("register / unregister", () => {
    it("registers a secret and increases size", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.register("key", "my-long-secret-value")).toBe(true);
      expect(reg.size).toBe(1);
      expect(reg.has("key")).toBe(true);
    });

    it("skips secrets shorter than 8 characters", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.register("key", "short")).toBe(false);
      expect(reg.size).toBe(0);
    });

    it("registers a secret that is exactly 8 characters", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.register("key", "12345678")).toBe(true);
      expect(reg.size).toBe(1);
    });

    it("skips a secret that is 7 characters", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.register("key", "1234567")).toBe(false);
      expect(reg.size).toBe(0);
    });

    it("skips empty strings", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.register("key", "")).toBe(false);
    });

    it("unregister removes a secret", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("key", "my-long-secret-value");
      expect(reg.unregister("key")).toBe(true);
      expect(reg.size).toBe(0);
      expect(reg.has("key")).toBe(false);
    });

    it("unregister returns false for unknown name", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.unregister("nope")).toBe(false);
    });

    it("overwrites existing secret with same name", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("key", "original-value-here");
      reg.register("key", "replaced-value-here");
      expect(reg.size).toBe(1);

      const masked = reg.mask("replaced-value-here");
      expect(masked).not.toContain("replaced-value-here");
    });
  });

  // -------------------------------------------------------------------------
  // Auto-discovery from process.env
  // -------------------------------------------------------------------------

  describe("init - env auto-discovery", () => {
    it("discovers secrets from env vars with secret-like key suffixes", () => {
      withEnv(
        {
          MY_API_KEY: "super-secret-api-key-12345",
          OPENAI_TOKEN: "sk-abcdefghijklmnopqrst",
          DB_PASSWORD: "database-password-value",
          HOME: "/home/user",
          PATH: "/usr/bin:/bin",
        },
        () => {
          const reg = SecretsRegistry.getInstance();
          reg.init();

          expect(reg.mask("key: super-secret-api-key-12345")).not.toContain(
            "super-secret-api-key-12345",
          );
          expect(reg.mask("token: sk-abcdefghijklmnopqrst")).not.toContain(
            "sk-abcdefghijklmnopqrst",
          );
          expect(reg.mask("pw: database-password-value")).not.toContain("database-password-value");
        },
      );
    });

    it("skips non-sensitive env vars", () => {
      withEnv(
        {
          HOME: "/home/user",
          PATH: "/usr/bin:/bin",
          NODE_ENV: "production",
          SHELL: "/bin/bash",
        },
        () => {
          const reg = SecretsRegistry.getInstance();
          reg.init();
          expect(reg.size).toBe(0);
        },
      );
    });

    it("skips env values shorter than 8 chars", () => {
      withEnv(
        {
          MY_API_KEY: "short",
        },
        () => {
          const reg = SecretsRegistry.getInstance();
          reg.init();
          expect(reg.size).toBe(0);
        },
      );
    });

    it("discovers secrets by value pattern (looksLikeSecret)", () => {
      withEnv(
        {
          SOME_RANDOM_VAR: "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabc",
        },
        () => {
          const reg = SecretsRegistry.getInstance();
          reg.init();
          expect(reg.mask("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabc")).not.toContain(
            "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabc",
          );
        },
      );
    });

    it("skipEnv option prevents env scanning", () => {
      withEnv(
        {
          MY_API_KEY: "super-secret-api-key-12345",
        },
        () => {
          const reg = SecretsRegistry.getInstance();
          reg.init(undefined, { skipEnv: true });
          expect(reg.size).toBe(0);
        },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Auto-discovery from config objects
  // -------------------------------------------------------------------------

  describe("init - config auto-discovery", () => {
    it("discovers secrets from config with sensitive keys", () => {
      const reg = SecretsRegistry.getInstance();
      reg.init(
        {
          apiKey: "config-api-key-value-1234",
          botToken: "config-bot-token-value-1234",
          name: "crocbot",
        },
        { skipEnv: true },
      );

      expect(reg.mask("config-api-key-value-1234")).not.toContain("config-api-key-value-1234");
      expect(reg.mask("config-bot-token-value-1234")).not.toContain("config-bot-token-value-1234");
      // Non-sensitive value should pass through
      expect(reg.mask("crocbot")).toBe("crocbot");
    });

    it("discovers nested config secrets", () => {
      const reg = SecretsRegistry.getInstance();
      reg.init(
        {
          providers: {
            openai: {
              apiKey: "nested-openai-api-key-val",
            },
          },
        },
        { skipEnv: true },
      );

      expect(reg.mask("nested-openai-api-key-val")).not.toContain("nested-openai-api-key-val");
    });

    it("handles empty config object", () => {
      const reg = SecretsRegistry.getInstance();
      reg.init({}, { skipEnv: true });
      expect(reg.size).toBe(0);
    });

    it("handles config with no sensitive keys", () => {
      const reg = SecretsRegistry.getInstance();
      reg.init(
        {
          name: "bot",
          version: "1.0",
          debug: true,
        },
        { skipEnv: true },
      );
      expect(reg.size).toBe(0);
    });

    it("skips config values shorter than minLength", () => {
      const reg = SecretsRegistry.getInstance();
      reg.init(
        {
          apiKey: "short",
        },
        { skipEnv: true },
      );
      expect(reg.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // mask / unmask
  // -------------------------------------------------------------------------

  describe("mask / unmask", () => {
    it("masks registered secret in text", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("k", "my-secret-value-1234");
      const placeholder = makePlaceholder("my-secret-value-1234");

      expect(reg.mask("the key is my-secret-value-1234 here")).toBe(
        `the key is ${placeholder} here`,
      );
    });

    it("unmasks placeholder back to original", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("k", "my-secret-value-1234");

      const masked = reg.mask("secret: my-secret-value-1234");
      const unmasked = reg.unmask(masked);
      expect(unmasked).toBe("secret: my-secret-value-1234");
    });

    it("round-trips correctly", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("a", "first-secret-abcdef");
      reg.register("b", "second-secret-ghijkl");

      const original = "a=first-secret-abcdef b=second-secret-ghijkl";
      expect(reg.unmask(reg.mask(original))).toBe(original);
    });

    it("mask returns text unchanged with empty registry", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.mask("nothing here")).toBe("nothing here");
    });

    it("unmask returns text unchanged with no placeholders", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("k", "some-secret-value-11");
      expect(reg.unmask("no placeholders")).toBe("no placeholders");
    });

    it("mask handles empty string", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("k", "some-secret-value-11");
      expect(reg.mask("")).toBe("");
    });

    it("unmask handles empty string", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.unmask("")).toBe("");
    });

    it("lazy recompile after register", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("k1", "first-secret-abcdef");

      // Trigger initial compile
      reg.mask("test");

      // Register a new secret -- should trigger lazy recompile
      reg.register("k2", "second-secret-ghijkl");

      const result = reg.mask("second-secret-ghijkl");
      expect(result).not.toContain("second-secret-ghijkl");
    });

    it("lazy recompile after unregister", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("k1", "removable-secret-val");

      // Trigger initial compile
      const masked = reg.mask("removable-secret-val");
      expect(masked).not.toContain("removable-secret-val");

      // Unregister -- should trigger lazy recompile
      reg.unregister("k1");
      expect(reg.mask("removable-secret-val")).toBe("removable-secret-val");
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("calling init multiple times accumulates secrets", () => {
      withEnv(
        {
          MY_API_KEY: "first-env-secret-value",
        },
        () => {
          const reg = SecretsRegistry.getInstance();
          reg.init(undefined, { skipEnv: false });
          const sizeAfterFirst = reg.size;

          reg.init({ password: "config-password-value" }, { skipEnv: true });
          expect(reg.size).toBeGreaterThan(sizeAfterFirst);
        },
      );
    });

    it("patternCount reflects encoding variants", () => {
      const reg = SecretsRegistry.getInstance();
      reg.register("k", "secret+with&specials");
      // Should have at least 2 patterns (raw + url-encoded)
      expect(reg.patternCount).toBeGreaterThanOrEqual(2);
    });

    it("safe to call mask before init", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.mask("anything")).toBe("anything");
    });

    it("safe to call unmask before init", () => {
      const reg = SecretsRegistry.getInstance();
      expect(reg.unmask("anything")).toBe("anything");
    });

    it("handles secrets with regex-special characters", () => {
      const reg = SecretsRegistry.getInstance();
      const secret = "value.with+regex$chars(here)";
      reg.register("k", secret);

      const result = reg.mask(`data: ${secret}`);
      expect(result).not.toContain(secret);
      expect(reg.unmask(result)).toBe(`data: ${secret}`);
    });

    it("custom minLength option", () => {
      SecretsRegistry.reset();
      const reg = SecretsRegistry.getInstance({ minLength: 12 });
      expect(reg.register("k", "12345678")).toBe(false); // 8 chars < 12
      expect(reg.register("k", "123456789012")).toBe(true); // 12 chars == 12
    });
  });
});
