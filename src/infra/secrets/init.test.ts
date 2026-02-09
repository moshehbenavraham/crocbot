import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initSecretsRegistry } from "./init.js";
import { SecretsRegistry } from "./registry.js";

describe("initSecretsRegistry", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  it("returns the singleton registry", () => {
    const registry = initSecretsRegistry();
    expect(registry).toBe(SecretsRegistry.getInstance());
  });

  it("discovers secrets from process.env", () => {
    const originalEnv = process.env.MY_TEST_API_KEY;
    process.env.MY_TEST_API_KEY = "sk-test-secret-value-1234567890";
    try {
      const registry = initSecretsRegistry();
      expect(registry.size).toBeGreaterThan(0);
      expect(registry.has("env:MY_TEST_API_KEY")).toBe(true);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.MY_TEST_API_KEY;
      } else {
        process.env.MY_TEST_API_KEY = originalEnv;
      }
    }
  });

  it("discovers secrets from a config object", () => {
    const config = {
      telegram: {
        botToken: "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi",
      },
    };
    const registry = initSecretsRegistry(config);
    expect(registry.has("config:telegram.botToken")).toBe(true);
  });

  it("masks discovered config secrets in text", () => {
    const token = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
    const config = {
      telegram: { botToken: token },
    };
    const registry = initSecretsRegistry(config, { skipEnv: true });
    const masked = registry.mask(`The token is ${token} here`);
    expect(masked).not.toContain(token);
    expect(masked).toMatch(/\{\{SECRET:[0-9a-f]{8}\}\}/);
  });

  it("handles empty config gracefully", () => {
    const registry = initSecretsRegistry({}, { skipEnv: true });
    expect(registry.size).toBe(0);
  });

  it("accumulates secrets on multiple calls", () => {
    const config1 = {
      apiKey: "sk-first-secret-value-12345678",
    };
    const config2 = {
      token: "ghp_secondSecretValueHere12345678",
    };
    initSecretsRegistry(config1, { skipEnv: true });
    const registry = initSecretsRegistry(config2, { skipEnv: true });
    expect(registry.has("config:apiKey")).toBe(true);
    expect(registry.has("config:token")).toBe(true);
  });

  it("skips env scanning when skipEnv is true", () => {
    const originalEnv = process.env.TEST_SKIP_SECRET;
    process.env.TEST_SKIP_SECRET = "sk-should-not-be-found-12345678";
    try {
      const registry = initSecretsRegistry(undefined, { skipEnv: true });
      expect(registry.has("env:TEST_SKIP_SECRET")).toBe(false);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.TEST_SKIP_SECRET;
      } else {
        process.env.TEST_SKIP_SECRET = originalEnv;
      }
    }
  });
});
