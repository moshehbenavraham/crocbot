/**
 * End-to-end integration tests for the secrets masking pipeline.
 *
 * Tests the complete flow: register secrets -> mask across all boundaries
 * (logging, LLM context, streaming, tool results, error output) -> unmask
 * at execution boundary. Validates that no registered secret value leaks
 * through any output path.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { redactConfigObject, redactConfigSnapshot } from "../../../config/redact.js";
import { maskErrorOutput } from "../error-masking.js";
import { maskStringsDeep } from "../logging-transport.js";
import { makePlaceholder } from "../masker.js";
import { SecretsRegistry } from "../registry.js";
import { StreamMasker } from "../stream-masker.js";
import { unmaskForExecution } from "../unmask-exec.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_SECRETS = {
  OPENAI_API_KEY: "sk-test-openai-key-1234567890abcdef",
  TELEGRAM_BOT_TOKEN: "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_abcdefgh",
  DATABASE_PASSWORD: "super-secret-db-password-42",
  GITHUB_PAT: "ghp_abcdefghijklmnopqrstuvwxyz1234",
  GROQ_API_KEY: "gsk_test_groq_api_key_value_long_enough",
} as const;

// Pre-compute placeholders for assertions
const PLACEHOLDERS: Record<string, string> = {};
for (const [key, value] of Object.entries(TEST_SECRETS)) {
  PLACEHOLDERS[key] = makePlaceholder(value);
}

// Placeholder pattern for generic matching
const PLACEHOLDER_RE = /\{\{SECRET:[0-9a-f]{8}\}\}/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFreshRegistry(): SecretsRegistry {
  SecretsRegistry.reset();
  return SecretsRegistry.getInstance({ minLength: 8 });
}

function registerTestSecrets(registry: SecretsRegistry): void {
  for (const [name, value] of Object.entries(TEST_SECRETS)) {
    registry.register(name, value);
  }
}

function assertNoSecretLeakage(output: unknown): void {
  const text = typeof output === "string" ? output : JSON.stringify(output);
  for (const [_name, value] of Object.entries(TEST_SECRETS)) {
    expect(text).not.toContain(value);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("e2e masking pipeline", () => {
  let registry: SecretsRegistry;

  beforeEach(() => {
    registry = createFreshRegistry();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  // =========================================================================
  // Full pipeline flow
  // =========================================================================

  describe("full pipeline flow", () => {
    it("masks secrets across all boundaries and unmasks at execution", () => {
      registerTestSecrets(registry);

      // Simulate a tool command containing secrets
      const toolCommand = `curl -H "Authorization: Bearer ${TEST_SECRETS.OPENAI_API_KEY}" https://api.example.com`;

      // 1. Mask in log transport (value-based + pattern-based)
      const logRecord = { message: toolCommand, level: "info" };
      const maskedLog = maskStringsDeep(logRecord, registry, true);
      assertNoSecretLeakage(maskedLog);

      // 2. Mask in LLM context (value-based only)
      const llmContext = {
        system: "You are a helpful assistant.",
        messages: [
          { role: "user", content: `Use key ${TEST_SECRETS.OPENAI_API_KEY} to call the API` },
        ],
      };
      const maskedContext = maskStringsDeep(llmContext, registry, false);
      assertNoSecretLeakage(maskedContext);
      // Placeholder should be present for later unmasking
      expect(JSON.stringify(maskedContext)).toContain(PLACEHOLDERS.OPENAI_API_KEY);

      // 3. Mask in streaming output
      const streamMasker = new StreamMasker(registry);
      const chunk1 = `Response: The API key is ${TEST_SECRETS.OPENAI_API_KEY.slice(0, 15)}`;
      const chunk2 = `${TEST_SECRETS.OPENAI_API_KEY.slice(15)} and done.`;
      const safeChunk1 = streamMasker.push(chunk1);
      const safeChunk2 = streamMasker.push(chunk2);
      const finalChunk = streamMasker.flush();
      const fullStream = safeChunk1 + safeChunk2 + finalChunk;
      assertNoSecretLeakage(fullStream);

      // 4. Mask in tool result
      const toolResult = {
        role: "toolResult" as const,
        content: [{ type: "text" as const, text: `Result: ${TEST_SECRETS.DATABASE_PASSWORD}` }],
      };
      const maskedResult = maskStringsDeep(toolResult, registry, false);
      assertNoSecretLeakage(maskedResult);
      expect(JSON.stringify(maskedResult)).toContain(PLACEHOLDERS.DATABASE_PASSWORD);

      // 5. Mask in error output
      const errorMsg = `Connection failed with password ${TEST_SECRETS.DATABASE_PASSWORD}`;
      const maskedError = registry.mask(errorMsg);
      assertNoSecretLeakage(maskedError);
      expect(maskedError).toContain(PLACEHOLDERS.DATABASE_PASSWORD);

      // 6. Unmask at execution boundary
      const maskedArgs = {
        command: `curl -H "Authorization: Bearer ${PLACEHOLDERS.OPENAI_API_KEY}" https://api.example.com`,
        env: { DB_PASS: PLACEHOLDERS.DATABASE_PASSWORD },
      };
      const unmaskedArgs = unmaskForExecution(maskedArgs, registry) as Record<string, unknown>;
      expect(unmaskedArgs.command as string).toContain(TEST_SECRETS.OPENAI_API_KEY);
      expect((unmaskedArgs.env as Record<string, string>).DB_PASS).toBe(
        TEST_SECRETS.DATABASE_PASSWORD,
      );
    });
  });

  // =========================================================================
  // Multi-secret scenarios
  // =========================================================================

  describe("multi-secret scenarios", () => {
    it("masks multiple secrets simultaneously without cross-contamination", () => {
      registerTestSecrets(registry);

      const text = [
        `OpenAI: ${TEST_SECRETS.OPENAI_API_KEY}`,
        `Telegram: ${TEST_SECRETS.TELEGRAM_BOT_TOKEN}`,
        `DB: ${TEST_SECRETS.DATABASE_PASSWORD}`,
        `GitHub: ${TEST_SECRETS.GITHUB_PAT}`,
        `Groq: ${TEST_SECRETS.GROQ_API_KEY}`,
      ].join("\n");

      const masked = registry.mask(text);
      assertNoSecretLeakage(masked);

      // Each secret has its own unique placeholder
      for (const [_key, placeholder] of Object.entries(PLACEHOLDERS)) {
        expect(masked).toContain(placeholder);
      }

      // Unmask round-trip preserves all values
      const unmasked = registry.unmask(masked);
      for (const value of Object.values(TEST_SECRETS)) {
        expect(unmasked).toContain(value);
      }
    });

    it("handles secrets with encoding variants (base64, URL)", () => {
      registerTestSecrets(registry);

      const apiKey = TEST_SECRETS.OPENAI_API_KEY;
      const b64Key = Buffer.from(apiKey, "utf-8").toString("base64");
      const urlKey = encodeURIComponent(apiKey);

      const text = `Raw: ${apiKey}\nBase64: ${b64Key}\nURL: ${urlKey}`;
      const masked = registry.mask(text);

      // All three encodings should be masked with the same placeholder
      expect(masked).not.toContain(apiKey);
      expect(masked).not.toContain(b64Key);
      expect(masked).not.toContain(urlKey);

      // Only one unique placeholder for this secret
      const placeholder = PLACEHOLDERS.OPENAI_API_KEY;
      const placeholderCount = masked.split(placeholder).length - 1;
      expect(placeholderCount).toBe(3);
    });

    it("masks secrets in deeply nested objects", () => {
      registerTestSecrets(registry);

      const nested = {
        level1: {
          level2: {
            level3: {
              secret: TEST_SECRETS.OPENAI_API_KEY,
              array: [TEST_SECRETS.DATABASE_PASSWORD, "safe-value"],
            },
          },
          text: `Token is ${TEST_SECRETS.TELEGRAM_BOT_TOKEN}`,
        },
      };

      const masked = maskStringsDeep(nested, registry, false);
      assertNoSecretLeakage(masked);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("edge cases", () => {
    it("handles base64-encoded secrets", () => {
      const secret = "sk-a-test-secret-value-for-b64";
      registry.register("b64_test", secret);

      const b64 = Buffer.from(secret, "utf-8").toString("base64");
      const text = `Authorization: Basic ${b64}`;
      const masked = registry.mask(text);

      expect(masked).not.toContain(b64);
      expect(masked).toContain("{{SECRET:");
    });

    it("handles URL-encoded secrets", () => {
      const secret = "sk-test+key/with=special&chars";
      registry.register("url_test", secret);

      const urlEncoded = encodeURIComponent(secret);
      const text = `?apiKey=${urlEncoded}`;
      const masked = registry.mask(text);

      expect(masked).not.toContain(urlEncoded);
      expect(masked).toContain("{{SECRET:");
    });

    it("handles secrets embedded in JSON values", () => {
      registerTestSecrets(registry);

      const json = JSON.stringify({
        apiKey: TEST_SECRETS.OPENAI_API_KEY,
        nested: { token: TEST_SECRETS.TELEGRAM_BOT_TOKEN },
      });

      const masked = registry.mask(json);
      assertNoSecretLeakage(masked);

      // Parse should still work (placeholder is a valid JSON string value)
      const parsed = JSON.parse(masked) as Record<string, unknown>;
      expect(parsed.apiKey).toBe(PLACEHOLDERS.OPENAI_API_KEY);
    });

    it("handles secrets appearing multiple times in the same text", () => {
      const secret = "sk-repeated-secret-value-12345";
      registry.register("repeated", secret);
      const placeholder = makePlaceholder(secret);

      const text = `First: ${secret}, Second: ${secret}, Third: ${secret}`;
      const masked = registry.mask(text);

      expect(masked).not.toContain(secret);
      const count = masked.split(placeholder).length - 1;
      expect(count).toBe(3);
    });

    it("handles secret that is a substring of another secret", () => {
      const shortSecret = "sk-test-key-12345678";
      const longSecret = "sk-test-key-1234567890-extended";
      registry.register("short", shortSecret);
      registry.register("long", longSecret);

      const text = `Long: ${longSecret} Short: ${shortSecret}`;
      const masked = registry.mask(text);

      expect(masked).not.toContain(shortSecret);
      expect(masked).not.toContain(longSecret);
    });

    it("handles empty string input", () => {
      registerTestSecrets(registry);

      expect(registry.mask("")).toBe("");
      expect(registry.unmask("")).toBe("");
      expect(maskStringsDeep("", registry, true)).toBe("");
      expect(maskStringsDeep("", registry, false)).toBe("");
      expect(unmaskForExecution("", registry)).toBe("");
    });

    it("handles null and undefined in deep masking", () => {
      registerTestSecrets(registry);

      expect(maskStringsDeep(null, registry, false)).toBeNull();
      expect(maskStringsDeep(undefined, registry, false)).toBeUndefined();
      expect(unmaskForExecution(null, registry)).toBeNull();
      expect(unmaskForExecution(undefined, registry)).toBeUndefined();
    });

    it("preserves non-string primitives in deep masking", () => {
      registerTestSecrets(registry);

      const obj = {
        count: 42,
        active: true,
        name: TEST_SECRETS.OPENAI_API_KEY,
      };

      const masked = maskStringsDeep(obj, registry, false) as Record<string, unknown>;
      expect(masked.count).toBe(42);
      expect(masked.active).toBe(true);
      expect(masked.name).toBe(PLACEHOLDERS.OPENAI_API_KEY);
    });

    it("handles secrets with special regex characters", () => {
      const secret = "sk-test.key+value[12345]";
      registry.register("regex_special", secret);

      const text = `Key: ${secret}`;
      const masked = registry.mask(text);

      expect(masked).not.toContain(secret);
      expect(masked).toContain("{{SECRET:");
    });
  });

  // =========================================================================
  // Round-trip integrity
  // =========================================================================

  describe("round-trip integrity", () => {
    it("mask -> unmask preserves original values exactly", () => {
      registerTestSecrets(registry);

      for (const [_name, value] of Object.entries(TEST_SECRETS)) {
        const masked = registry.mask(value);
        expect(masked).not.toBe(value);
        expect(masked).toMatch(PLACEHOLDER_RE);

        const unmasked = registry.unmask(masked);
        expect(unmasked).toBe(value);
      }
    });

    it("mask -> persist -> unmask cycle preserves originals", () => {
      registerTestSecrets(registry);

      const original = {
        command: `export API_KEY="${TEST_SECRETS.OPENAI_API_KEY}" && curl -H "Token: ${TEST_SECRETS.TELEGRAM_BOT_TOKEN}" https://api.example.com`,
        env: {
          DB_PASSWORD: TEST_SECRETS.DATABASE_PASSWORD,
          GITHUB_TOKEN: TEST_SECRETS.GITHUB_PAT,
        },
      };

      // Mask
      const masked = maskStringsDeep(original, registry, false) as typeof original;
      assertNoSecretLeakage(masked);

      // Persist (serialize/deserialize)
      const serialized = JSON.stringify(masked);
      assertNoSecretLeakage(serialized);
      const deserialized = JSON.parse(serialized) as typeof original;

      // Unmask
      const restored = unmaskForExecution(deserialized, registry) as typeof original;
      expect(restored.command).toBe(original.command);
      expect(restored.env.DB_PASSWORD).toBe(TEST_SECRETS.DATABASE_PASSWORD);
      expect(restored.env.GITHUB_TOKEN).toBe(TEST_SECRETS.GITHUB_PAT);
    });

    it("deep-mask -> deep-unmask round-trip on nested structures", () => {
      registerTestSecrets(registry);

      const original = {
        level1: {
          secret: TEST_SECRETS.OPENAI_API_KEY,
          nested: {
            token: TEST_SECRETS.TELEGRAM_BOT_TOKEN,
            list: [TEST_SECRETS.DATABASE_PASSWORD, "safe"],
          },
        },
      };

      const masked = maskStringsDeep(original, registry, false);
      assertNoSecretLeakage(masked);

      const restored = unmaskForExecution(masked, registry) as typeof original;
      expect(restored.level1.secret).toBe(TEST_SECRETS.OPENAI_API_KEY);
      expect(restored.level1.nested.token).toBe(TEST_SECRETS.TELEGRAM_BOT_TOKEN);
      expect(restored.level1.nested.list[0]).toBe(TEST_SECRETS.DATABASE_PASSWORD);
      expect(restored.level1.nested.list[1]).toBe("safe");
    });
  });

  // =========================================================================
  // Scale tests
  // =========================================================================

  describe("scale tests", () => {
    it("empty registry adds zero masking overhead", () => {
      // Registry is fresh and empty
      expect(registry.size).toBe(0);

      const text = "This is a normal log line with no secrets at all.";
      const masked = registry.mask(text);
      expect(masked).toBe(text);

      const unmasked = registry.unmask(text);
      expect(unmasked).toBe(text);
    });

    it("large registry (100+ secrets) masks correctly", () => {
      // Register 120 secrets to trigger Aho-Corasick path
      for (let i = 0; i < 120; i++) {
        registry.register(`secret_${i}`, `sk-test-secret-value-${String(i).padStart(4, "0")}`);
      }
      expect(registry.size).toBe(120);

      // Build text with every 10th secret embedded
      const parts: string[] = [];
      for (let i = 0; i < 120; i += 10) {
        parts.push(`key_${i}=sk-test-secret-value-${String(i).padStart(4, "0")}`);
      }
      const text = parts.join(" | ");

      const masked = registry.mask(text);
      for (let i = 0; i < 120; i += 10) {
        expect(masked).not.toContain(`sk-test-secret-value-${String(i).padStart(4, "0")}`);
      }

      // Unmask restores all
      const unmasked = registry.unmask(masked);
      for (let i = 0; i < 120; i += 10) {
        expect(unmasked).toContain(`sk-test-secret-value-${String(i).padStart(4, "0")}`);
      }
    });

    it("100KB+ text with embedded secrets is fully masked", () => {
      registerTestSecrets(registry);

      // Build 100KB text with secrets at start, middle, and end
      const padding = "x".repeat(1024);
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        if (i === 0) {
          lines.push(`START: ${TEST_SECRETS.OPENAI_API_KEY} ${padding}`);
        } else if (i === 50) {
          lines.push(`MIDDLE: ${TEST_SECRETS.TELEGRAM_BOT_TOKEN} ${padding}`);
        } else if (i === 99) {
          lines.push(`END: ${TEST_SECRETS.DATABASE_PASSWORD} ${padding}`);
        } else {
          lines.push(`line ${i}: ${padding}`);
        }
      }
      const largeText = lines.join("\n");
      expect(largeText.length).toBeGreaterThan(100 * 1024);

      const masked = registry.mask(largeText);
      assertNoSecretLeakage(masked);
      expect(masked).toContain(PLACEHOLDERS.OPENAI_API_KEY);
      expect(masked).toContain(PLACEHOLDERS.TELEGRAM_BOT_TOKEN);
      expect(masked).toContain(PLACEHOLDERS.DATABASE_PASSWORD);
    });
  });

  // =========================================================================
  // Streaming boundary detection
  // =========================================================================

  describe("streaming boundary detection", () => {
    it("detects secrets split across chunk boundaries", () => {
      const secret = "sk-test-split-boundary-secret";
      registry.register("split_test", secret);

      const streamMasker = new StreamMasker(registry);

      // Split the secret across two chunks
      const splitPoint = Math.floor(secret.length / 2);
      const chunk1 = `prefix ${secret.slice(0, splitPoint)}`;
      const chunk2 = `${secret.slice(splitPoint)} suffix`;

      const out1 = streamMasker.push(chunk1);
      const out2 = streamMasker.push(chunk2);
      const out3 = streamMasker.flush();
      const fullOutput = out1 + out2 + out3;

      expect(fullOutput).not.toContain(secret);
      expect(fullOutput).toContain("{{SECRET:");
      expect(fullOutput).toContain("prefix");
      expect(fullOutput).toContain("suffix");
    });

    it("handles multiple chunks with no secrets", () => {
      registerTestSecrets(registry);

      const streamMasker = new StreamMasker(registry);
      const chunks = ["Hello ", "world, ", "this is ", "safe text."];

      let output = "";
      for (const chunk of chunks) {
        output += streamMasker.push(chunk);
      }
      output += streamMasker.flush();

      expect(output).toBe("Hello world, this is safe text.");
    });

    it("flush on empty stream returns empty", () => {
      registerTestSecrets(registry);

      const streamMasker = new StreamMasker(registry);
      expect(streamMasker.flush()).toBe("");
    });
  });

  // =========================================================================
  // Error boundary
  // =========================================================================

  describe("error boundary masking", () => {
    it("masks secrets in error messages via maskErrorOutput", () => {
      registerTestSecrets(registry);

      const errorText = `Error: Authentication failed for key ${TEST_SECRETS.OPENAI_API_KEY} at endpoint /api/v1`;
      const masked = maskErrorOutput(errorText);

      assertNoSecretLeakage(masked);
      expect(masked).toContain(PLACEHOLDERS.OPENAI_API_KEY);
      expect(masked).toContain("Error: Authentication failed for key");
    });

    it("masks secrets in stack traces", () => {
      registerTestSecrets(registry);

      const stackTrace = [
        `Error: Request failed with status 401`,
        `  at fetch (${TEST_SECRETS.OPENAI_API_KEY})`,
        `  at callApi (/src/api.ts:42:5)`,
        `  headers: { Authorization: "Bearer ${TEST_SECRETS.TELEGRAM_BOT_TOKEN}" }`,
      ].join("\n");

      const masked = maskErrorOutput(stackTrace);
      assertNoSecretLeakage(masked);
    });
  });

  // =========================================================================
  // Config snapshot masking
  // =========================================================================

  describe("config snapshot masking", () => {
    it("redactConfigObject masks sensitive keys with [REDACTED]", () => {
      const config = {
        botToken: TEST_SECRETS.TELEGRAM_BOT_TOKEN,
        apiKey: TEST_SECRETS.OPENAI_API_KEY,
        name: "crocbot",
        port: 3000,
      };

      const redacted = redactConfigObject(config);
      expect(redacted.botToken).toBe("[REDACTED]");
      expect(redacted.apiKey).toBe("[REDACTED]");
      expect(redacted.name).toBe("crocbot");
      expect(redacted.port).toBe(3000);
    });

    it("redactConfigSnapshot masks raw, parsed, and config fields", () => {
      registerTestSecrets(registry);

      const snapshot = {
        raw: `{"botToken": "${TEST_SECRETS.TELEGRAM_BOT_TOKEN}"}`,
        parsed: { botToken: TEST_SECRETS.TELEGRAM_BOT_TOKEN },
        config: { botToken: TEST_SECRETS.TELEGRAM_BOT_TOKEN, name: "crocbot" },
      };

      const redacted = redactConfigSnapshot(snapshot);
      // raw is fully redacted
      expect(redacted.raw).toBe("[REDACTED]");
      // parsed.botToken gets key-based [REDACTED] then value-based masking
      assertNoSecretLeakage(redacted);
    });
  });
});
