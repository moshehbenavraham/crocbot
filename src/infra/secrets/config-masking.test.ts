import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { redactConfigSnapshot } from "../../config/redact.js";
import { SecretsRegistry } from "./registry.js";

describe("config snapshot masking integration", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  it("does not registry-mask non-sensitive keys in config snapshot parsed object", () => {
    // Values under non-sensitive key names that don't match looksLikeSecret
    // heuristics are preserved as-is (no registry masking in config snapshots).
    const secret = "my-custom-database-connection-string-12345678";
    const registry = SecretsRegistry.getInstance();
    registry.register("db-conn", secret);

    const snapshot = {
      raw: "",
      parsed: {
        providers: {
          openai: {
            customField: secret,
          },
        },
      },
      config: {
        providers: {
          openai: {
            customField: secret,
          },
        },
      },
    };

    const redacted = redactConfigSnapshot(snapshot);
    const parsed = redacted.parsed as Record<string, unknown>;
    const providers = parsed.providers as Record<string, unknown>;
    const openai = providers.openai as Record<string, unknown>;
    // customField is not a sensitive key and the value doesn't match secret heuristics
    expect(openai.customField).toBe(secret);
  });

  it("does not registry-mask secrets embedded in non-sensitive config keys", () => {
    // Registry masking is not applied to config snapshots; only key-based
    // and heuristic value-based redaction applies.
    const secret = "ghp_configSnapshotGithubTokenTest1234";
    const registry = SecretsRegistry.getInstance();
    registry.register("github-token", secret);

    const snapshot = {
      config: {
        integrations: {
          github: {
            customData: `auth: ${secret}`,
          },
        },
      },
    };

    const redacted = redactConfigSnapshot(snapshot);
    const config = redacted.config as Record<string, unknown>;
    const integrations = config.integrations as Record<string, unknown>;
    const github = integrations.github as Record<string, unknown>;
    // customData is not a sensitive key; the value contains a secret but is
    // prefixed with "auth: " so looksLikeSecret won't match the full string.
    expect(github.customData).toContain(secret);
  });

  it("preserves key-based redaction without registry masking", () => {
    const registry = SecretsRegistry.getInstance();
    registry.register("extra-secret", "extra-secret-value-here-12345");

    const snapshot = {
      parsed: {
        apiKey: "should-be-redacted-by-key-name",
        normalField: "contains extra-secret-value-here-12345",
      },
      config: {
        apiKey: "also-should-be-redacted-by-key",
        safeField: "no secrets here",
      },
    };

    const redacted = redactConfigSnapshot(snapshot);
    const parsed = redacted.parsed as Record<string, unknown>;
    // apiKey should be redacted by key-based redaction
    expect(parsed.apiKey).toBe("[REDACTED]");
    // normalField is not a sensitive key and value doesn't match heuristics,
    // so it is preserved as-is (no registry masking in config snapshots).
    expect(parsed.normalField).toBe("contains extra-secret-value-here-12345");
  });

  it("does not alter config snapshot when registry is empty", () => {
    const snapshot = {
      parsed: {
        normalField: "just some text",
        count: 42,
      },
      config: {
        name: "crocbot",
        enabled: true,
      },
    };

    const redacted = redactConfigSnapshot(snapshot);
    const parsed = redacted.parsed as Record<string, unknown>;
    expect(parsed.normalField).toBe("just some text");
    expect(parsed.count).toBe(42);
  });

  it("handles raw field being completely redacted", () => {
    const registry = SecretsRegistry.getInstance();
    registry.register("raw-secret", "some-raw-secret-in-config-12345");

    const snapshot = {
      raw: "some raw config text with some-raw-secret-in-config-12345",
      parsed: {},
      config: {},
    };

    const redacted = redactConfigSnapshot(snapshot);
    // raw should be completely replaced with [REDACTED]
    expect(redacted.raw).toBe("[REDACTED]");
  });

  it("does not registry-mask secrets in nested arrays", () => {
    const secret = "sk-array-nested-secret-value-test1234";
    const registry = SecretsRegistry.getInstance();
    registry.register("array-secret", secret);

    const snapshot = {
      config: {
        items: [{ value: `token: ${secret}` }, { value: "safe value" }],
      },
    };

    const redacted = redactConfigSnapshot(snapshot);
    const config = redacted.config as Record<string, unknown>;
    const items = config.items as Array<Record<string, unknown>>;
    // value is not a sensitive key; the string is prefixed so looksLikeSecret
    // won't match the full value.  No registry masking in config snapshots.
    expect(items[0].value).toBe(`token: ${secret}`);
    expect(items[1].value).toBe("safe value");
  });
});
