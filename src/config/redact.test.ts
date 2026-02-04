import { describe, expect, it } from "vitest";

import {
  getSensitiveExactKeys,
  getSensitiveKeyPatterns,
  redactConfigObject,
  redactConfigSnapshot,
} from "./redact.js";

describe("redactConfigObject", () => {
  it("redacts apiKey values", () => {
    const input = { apiKey: "sk-secret-key-123" };
    const result = redactConfigObject(input);
    expect(result.apiKey).toBe("[REDACTED]");
  });

  it("redacts token values", () => {
    const input = { token: "ghp_xxxxxxxxxxxx" };
    const result = redactConfigObject(input);
    expect(result.token).toBe("[REDACTED]");
  });

  it("redacts botToken values", () => {
    const input = { botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz" };
    const result = redactConfigObject(input);
    expect(result.botToken).toBe("[REDACTED]");
  });

  it("redacts password values", () => {
    const input = { password: "super-secret-password" };
    const result = redactConfigObject(input);
    expect(result.password).toBe("[REDACTED]");
  });

  it("redacts secret values", () => {
    const input = { secret: "webhook-secret-value", webhookSecret: "another-secret" };
    const result = redactConfigObject(input);
    expect(result.secret).toBe("[REDACTED]");
    expect(result.webhookSecret).toBe("[REDACTED]");
  });

  it("preserves non-sensitive values", () => {
    const input = { name: "My Bot", port: 8080, enabled: true };
    const result = redactConfigObject(input);
    expect(result.name).toBe("My Bot");
    expect(result.port).toBe(8080);
    expect(result.enabled).toBe(true);
  });

  it("handles nested objects recursively", () => {
    const input = {
      gateway: {
        auth: {
          token: "secret-token",
          mode: "token",
        },
        port: 18789,
      },
    };
    const result = redactConfigObject(input);
    expect((result.gateway as Record<string, unknown>).port).toBe(18789);
    const auth = (result.gateway as Record<string, Record<string, unknown>>).auth;
    expect(auth.token).toBe("[REDACTED]");
    expect(auth.mode).toBe("token");
  });

  it("handles deeply nested structures", () => {
    const input = {
      channels: {
        telegram: {
          accounts: {
            main: {
              botToken: "123456:ABC",
              webhookSecret: "webhook-secret",
              name: "MainBot",
            },
          },
        },
      },
    };
    const result = redactConfigObject(input);
    const account = (
      (result.channels as Record<string, Record<string, Record<string, Record<string, unknown>>>>)
        .telegram.accounts as Record<string, Record<string, unknown>>
    ).main;
    expect(account.botToken).toBe("[REDACTED]");
    expect(account.webhookSecret).toBe("[REDACTED]");
    expect(account.name).toBe("MainBot");
  });

  it("handles arrays", () => {
    const input = {
      items: [{ apiKey: "key1" }, { apiKey: "key2" }, { name: "test" }],
    };
    const result = redactConfigObject(input);
    const items = result.items as Array<Record<string, unknown>>;
    expect(items[0].apiKey).toBe("[REDACTED]");
    expect(items[1].apiKey).toBe("[REDACTED]");
    expect(items[2].name).toBe("test");
  });

  it("preserves null and undefined values", () => {
    const input = { apiKey: null, token: undefined, name: "test" };
    const result = redactConfigObject(input);
    expect(result.apiKey).toBeNull();
    expect(result.token).toBeUndefined();
    expect(result.name).toBe("test");
  });

  it("preserves empty strings for sensitive keys", () => {
    const input = { apiKey: "", token: "" };
    const result = redactConfigObject(input);
    expect(result.apiKey).toBe("");
    expect(result.token).toBe("");
  });

  it("redacts values that look like secrets even without sensitive key names", () => {
    const input = {
      customField: "sk-proj-abcdef123456789", // OpenAI-style key
    };
    const result = redactConfigObject(input);
    expect(result.customField).toBe("[REDACTED]");
  });

  it("redacts Telegram bot tokens by pattern", () => {
    const input = {
      customToken: "1234567890:ABCDEFghijklMNOPqrstuvwxyz",
    };
    const result = redactConfigObject(input);
    expect(result.customToken).toBe("[REDACTED]");
  });

  it("redacts GitHub PAT tokens by pattern", () => {
    const input = {
      ghToken: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    };
    const result = redactConfigObject(input);
    expect(result.ghToken).toBe("[REDACTED]");
  });

  it("handles models config with apiKey", () => {
    const input = {
      models: {
        providers: {
          openai: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "sk-real-api-key-here",
            models: [{ id: "gpt-4", name: "GPT-4" }],
          },
        },
      },
    };
    const result = redactConfigObject(input);
    const provider = (result.models as Record<string, Record<string, Record<string, unknown>>>)
      .providers.openai;
    expect(provider.baseUrl).toBe("https://api.openai.com/v1");
    expect(provider.apiKey).toBe("[REDACTED]");
  });

  it("handles talk config with apiKey", () => {
    const input = {
      talk: {
        voiceId: "voice-123",
        apiKey: "eleven-labs-api-key",
      },
    };
    const result = redactConfigObject(input);
    const talk = result.talk as Record<string, unknown>;
    expect(talk.voiceId).toBe("voice-123");
    expect(talk.apiKey).toBe("[REDACTED]");
  });
});

describe("redactConfigSnapshot", () => {
  it("redacts raw field completely", () => {
    const input = {
      path: "/path/to/config.json",
      exists: true,
      raw: '{"apiKey": "secret-value", "name": "test"}',
      parsed: { apiKey: "secret-value", name: "test" },
      config: { apiKey: "secret-value", name: "test" },
      valid: true,
      hash: "abc123",
      issues: [],
      warnings: [],
      legacyIssues: [],
    };
    const result = redactConfigSnapshot(input);
    expect(result.raw).toBe("[REDACTED]");
    expect(result.path).toBe("/path/to/config.json");
    expect(result.hash).toBe("abc123");
  });

  it("redacts parsed object", () => {
    const input = {
      raw: "raw config",
      parsed: { botToken: "123:ABC", name: "test" },
      config: {},
    };
    const result = redactConfigSnapshot(input);
    expect((result.parsed as Record<string, unknown>).botToken).toBe("[REDACTED]");
    expect((result.parsed as Record<string, unknown>).name).toBe("test");
  });

  it("redacts config object", () => {
    const input = {
      raw: "raw config",
      parsed: {},
      config: {
        gateway: {
          auth: { token: "secret-token", mode: "token" },
        },
      },
    };
    const result = redactConfigSnapshot(input);
    const auth = (result.config as Record<string, Record<string, Record<string, unknown>>>).gateway
      .auth;
    expect(auth.token).toBe("[REDACTED]");
    expect(auth.mode).toBe("token");
  });

  it("preserves null raw value", () => {
    const input = {
      raw: null,
      parsed: {},
      config: {},
    };
    const result = redactConfigSnapshot(input);
    expect(result.raw).toBeNull();
  });

  it("preserves empty raw string", () => {
    const input = {
      raw: "",
      parsed: {},
      config: {},
    };
    const result = redactConfigSnapshot(input);
    expect(result.raw).toBe("");
  });
});

describe("getSensitiveKeyPatterns", () => {
  it("returns array of pattern strings", () => {
    const patterns = getSensitiveKeyPatterns();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some((p) => p.includes("apiKey"))).toBe(true);
    expect(patterns.some((p) => p.includes("token"))).toBe(true);
    expect(patterns.some((p) => p.includes("password"))).toBe(true);
  });
});

describe("getSensitiveExactKeys", () => {
  it("returns array of exact key names", () => {
    const keys = getSensitiveExactKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys).toContain("botToken");
    expect(keys).toContain("apiKey");
    expect(keys).toContain("password");
    expect(keys).toContain("secret");
  });
});
