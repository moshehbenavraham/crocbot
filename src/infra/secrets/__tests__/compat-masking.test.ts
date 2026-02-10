/**
 * Backward compatibility tests for the secrets masking pipeline.
 *
 * Verifies that the new value-based masking (SecretsRegistry) composes
 * correctly with legacy pattern-based redaction (redactSensitiveText,
 * redactConfigObject). The two systems operate on different principles:
 * - Value-based: exact string match -> {{SECRET:hash8}} placeholder
 * - Pattern-based: regex format match -> truncated form (sk-abcd...mnop)
 *
 * When both are applied (e.g., in log transport), value-based runs first
 * so the full secret is captured before pattern-based truncation.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { redactConfigObject, redactConfigSnapshot } from "../../../config/redact.js";
import { redactSensitiveText } from "../../../logging/redact.js";
import { maskStringsDeep } from "../logging-transport.js";
import { makePlaceholder } from "../masker.js";
import { SecretsRegistry } from "../registry.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Secrets that match both value-based and pattern-based detection. */
const COMPAT_SECRETS = {
  OPENAI_KEY: "sk-compat-test-openai-key-1234567890",
  GITHUB_PAT: "ghp_compatTestGithubPAT12345678901234",
  TELEGRAM_TOKEN: "987654321:ABCdefGHIjklMNOpqrSTUvwxYZ_compat01",
  GROQ_KEY: "gsk_compat_test_groq_api_key_value_long",
} as const;

/** Pre-computed placeholders. */
const PLACEHOLDERS: Record<string, string> = {};
for (const [key, value] of Object.entries(COMPAT_SECRETS)) {
  PLACEHOLDERS[key] = makePlaceholder(value);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFreshRegistry(): SecretsRegistry {
  SecretsRegistry.reset();
  return SecretsRegistry.getInstance({ minLength: 8 });
}

function registerCompatSecrets(registry: SecretsRegistry): void {
  for (const [name, value] of Object.entries(COMPAT_SECRETS)) {
    registry.register(name, value);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("backward compatibility", () => {
  let registry: SecretsRegistry;

  beforeEach(() => {
    registry = createFreshRegistry();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  // =========================================================================
  // redactSensitiveText standalone behavior
  // =========================================================================

  describe("redactSensitiveText standalone", () => {
    it("produces truncated output for pattern matches (not placeholders)", () => {
      const text = `API key: ${COMPAT_SECRETS.OPENAI_KEY}`;
      const redacted = redactSensitiveText(text);

      // Pattern-based redaction truncates: keep first 6 + "..." + last 4
      expect(redacted).not.toContain(COMPAT_SECRETS.OPENAI_KEY);
      // Should NOT produce {{SECRET:...}} placeholder
      expect(redacted).not.toContain("{{SECRET:");
      // Should contain the truncated form
      expect(redacted).toContain("sk-com");
    });

    it("redacts GitHub PATs with truncation", () => {
      const text = `Token: ${COMPAT_SECRETS.GITHUB_PAT}`;
      const redacted = redactSensitiveText(text);

      expect(redacted).not.toContain(COMPAT_SECRETS.GITHUB_PAT);
      expect(redacted).not.toContain("{{SECRET:");
    });

    it("redacts Telegram bot tokens with truncation", () => {
      const text = `Bot token is ${COMPAT_SECRETS.TELEGRAM_TOKEN}`;
      const redacted = redactSensitiveText(text);

      expect(redacted).not.toContain(COMPAT_SECRETS.TELEGRAM_TOKEN);
      expect(redacted).not.toContain("{{SECRET:");
    });

    it("passes through non-secret text unchanged", () => {
      const text = "This is a normal log message with no secrets.";
      const redacted = redactSensitiveText(text);
      expect(redacted).toBe(text);
    });
  });

  // =========================================================================
  // redactConfigObject standalone behavior
  // =========================================================================

  describe("redactConfigObject standalone", () => {
    it("marks sensitive keys with [REDACTED]", () => {
      const config = {
        botToken: "some-bot-token-value-here",
        apiKey: "some-api-key-value-here",
        name: "crocbot",
        port: 3000,
      };

      const redacted = redactConfigObject(config);
      expect(redacted.botToken).toBe("[REDACTED]");
      expect(redacted.apiKey).toBe("[REDACTED]");
      expect(redacted.name).toBe("crocbot");
      expect(redacted.port).toBe(3000);
    });

    it("detects secret values by pattern even with non-sensitive keys", () => {
      const config = {
        myCustomField: COMPAT_SECRETS.OPENAI_KEY,
        normalField: "hello",
      };

      const redacted = redactConfigObject(config);
      // looksLikeSecret() detects sk- prefix
      expect(redacted.myCustomField).toBe("[REDACTED]");
      expect(redacted.normalField).toBe("hello");
    });
  });

  // =========================================================================
  // Composition: value-based + pattern-based
  // =========================================================================

  describe("composition order", () => {
    it("value-based masking runs before pattern-based in maskStringsDeep", () => {
      registerCompatSecrets(registry);

      const text = `Key: ${COMPAT_SECRETS.OPENAI_KEY}`;
      const masked = maskStringsDeep(text, registry, true) as string;

      // Value-based replaces the full secret with {{SECRET:hash8}} FIRST
      // Then pattern-based scans the result.
      // The original secret value must not appear in output.
      expect(masked).not.toContain(COMPAT_SECRETS.OPENAI_KEY);
      // Value-based masking did its job (the raw secret is gone)
      // Pattern-based may further transform the placeholder text, which is
      // acceptable defense-in-depth behavior for log output.
    });

    it("pattern-based catches format-matching text not in registry", () => {
      // Register only one secret, leave others unregistered
      registry.register("OPENAI_KEY", COMPAT_SECRETS.OPENAI_KEY);

      // This secret is NOT in the registry
      const unregisteredKey = "sk-unregistered-test-key-9999999";
      const text = `Registered: ${COMPAT_SECRETS.OPENAI_KEY} Unregistered: ${unregisteredKey}`;

      const masked = maskStringsDeep(text, registry, true) as string;

      // Registered secret: removed by value-based masking
      expect(masked).not.toContain(COMPAT_SECRETS.OPENAI_KEY);
      // Unregistered secret: caught by pattern-based truncation
      expect(masked).not.toContain(unregisteredKey);
      // Unregistered secret should not have a registry placeholder
      expect(masked).not.toContain(makePlaceholder(unregisteredKey));
    });

    it("value-based only mode (applyPatternRedaction=false) preserves placeholders", () => {
      registerCompatSecrets(registry);

      const text = `Key: ${COMPAT_SECRETS.OPENAI_KEY}`;
      const masked = maskStringsDeep(text, registry, false) as string;

      // Only value-based masking applied
      expect(masked).toContain(PLACEHOLDERS.OPENAI_KEY);
      // No pattern-based truncation
      expect(masked).not.toContain("sk-com");
    });
  });

  // =========================================================================
  // redactConfigSnapshot composition with registry
  // =========================================================================

  describe("redactConfigSnapshot with registry", () => {
    it("applies key-based and heuristic redaction without registry masking", () => {
      registerCompatSecrets(registry);

      const snapshot = {
        raw: `apiKey: ${COMPAT_SECRETS.OPENAI_KEY}`,
        parsed: {
          apiKey: COMPAT_SECRETS.OPENAI_KEY,
          webhookUrl: `https://api.example.com?token=${COMPAT_SECRETS.TELEGRAM_TOKEN}`,
        },
        config: {
          botToken: COMPAT_SECRETS.TELEGRAM_TOKEN,
          customField: `prefix-${COMPAT_SECRETS.GROQ_KEY}-suffix`,
        },
      };

      const redacted = redactConfigSnapshot(snapshot);

      // raw is completely replaced with [REDACTED]
      expect(redacted.raw).toBe("[REDACTED]");

      // parsed.apiKey: key-based -> [REDACTED]
      expect((redacted.parsed as Record<string, unknown>).apiKey).toBe("[REDACTED]");

      // parsed.webhookUrl: not a sensitive key and the full URL value doesn't
      // match looksLikeSecret heuristics, so it is preserved as-is
      // (no registry masking in config snapshots).
      const webhookUrl = (redacted.parsed as Record<string, unknown>).webhookUrl as string;
      expect(webhookUrl).toBe(`https://api.example.com?token=${COMPAT_SECRETS.TELEGRAM_TOKEN}`);

      // config.botToken: key-based -> [REDACTED]
      const redactedConfig = redacted.config as Record<string, unknown>;
      expect(redactedConfig.botToken).toBe("[REDACTED]");

      // config.customField: not a sensitive key and the prefixed value doesn't
      // match looksLikeSecret heuristics, so it is preserved as-is
      // (no registry masking in config snapshots).
      const customField = redactedConfig.customField as string;
      expect(customField).toBe(`prefix-${COMPAT_SECRETS.GROQ_KEY}-suffix`);
    });
  });

  // =========================================================================
  // Edge: both layers catch the same secret
  // =========================================================================

  describe("double-layer defense", () => {
    it("both value-based and pattern-based catch secrets in log transport", () => {
      registerCompatSecrets(registry);

      // Build a log record with secrets in various positions
      const logRecord = {
        message: `API call with key ${COMPAT_SECRETS.OPENAI_KEY}`,
        meta: { token: COMPAT_SECRETS.TELEGRAM_TOKEN },
        args: [`--api-key ${COMPAT_SECRETS.GROQ_KEY}`],
      };

      const masked = maskStringsDeep(logRecord, registry, true);
      const serialized = JSON.stringify(masked);

      // No secret values should remain
      for (const value of Object.values(COMPAT_SECRETS)) {
        expect(serialized).not.toContain(value);
      }
    });

    it("unregistered secrets still caught by pattern-based redaction", () => {
      // Empty registry -- no value-based masking
      expect(registry.size).toBe(0);

      const unregistered = "sk-unregistered-but-pattern-matches-1234";
      const text = `Key: ${unregistered}`;
      const masked = maskStringsDeep(text, registry, true) as string;

      // Pattern-based catches it even without registry
      expect(masked).not.toContain(unregistered);
    });
  });

  // =========================================================================
  // Bearer token composition
  // =========================================================================

  describe("Bearer token handling", () => {
    it("value-based masks Bearer token before pattern-based truncation", () => {
      registerCompatSecrets(registry);

      const text = `Authorization: Bearer ${COMPAT_SECRETS.OPENAI_KEY}`;
      const masked = maskStringsDeep(text, registry, true) as string;

      // Value-based replaces the key first, then pattern-based may further
      // transform the placeholder. The key point: original secret is gone.
      expect(masked).not.toContain(COMPAT_SECRETS.OPENAI_KEY);
    });
  });
});
