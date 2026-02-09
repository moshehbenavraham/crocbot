/**
 * Performance benchmark tests for the secrets masking pipeline.
 *
 * Uses median-of-N (N=10) approach with warmup discard to reduce CI
 * flakiness. Thresholds are set at 3x expected to accommodate runner
 * variability.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { maskStringsDeep } from "../logging-transport.js";
import { SecretsRegistry } from "../registry.js";
import { StreamMasker } from "../stream-masker.js";

// ---------------------------------------------------------------------------
// Benchmark helper
// ---------------------------------------------------------------------------

/**
 * Run a benchmark function N+1 times (1 warmup + N measured), return the
 * median duration in milliseconds.
 */
function medianOfN(fn: () => void, n = 10): number {
  // Warmup (discarded)
  fn();

  const durations: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    fn();
    durations.push(performance.now() - start);
  }

  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  return durations.length % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BENCHMARK_SECRETS: Record<string, string> = {
  OPENAI_KEY: "sk-bench-openai-key-1234567890abcdef",
  TELEGRAM_TOKEN: "999888777:ABCdefGHIjklMNOpqrSTUvwxYZ_benchtest",
  DB_PASSWORD: "bench-secret-db-password-value42",
  GITHUB_PAT: "ghp_benchmarkpattoken12345678901234",
  GROQ_KEY: "gsk_bench_groq_api_key_value_long_enough",
};

function createBenchRegistry(): SecretsRegistry {
  SecretsRegistry.reset();
  const registry = SecretsRegistry.getInstance({ minLength: 8 });
  for (const [name, value] of Object.entries(BENCHMARK_SECRETS)) {
    registry.register(name, value);
  }
  return registry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("masking performance benchmarks", () => {
  let registry: SecretsRegistry;

  beforeEach(() => {
    registry = createBenchRegistry();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  // =========================================================================
  // Log masking benchmark
  // =========================================================================

  describe("log masking", () => {
    it("masks 1000 log lines x 5 secrets in <1ms/line median", () => {
      // Build 1000 log lines, each containing one of the 5 secrets
      const secretValues = Object.values(BENCHMARK_SECRETS);
      const lines: string[] = [];
      for (let i = 0; i < 1000; i++) {
        const secret = secretValues[i % secretValues.length];
        lines.push(
          `[INFO] ${new Date().toISOString()} Request processed with key ${secret} status=200 duration=42ms`,
        );
      }

      const totalMs = medianOfN(() => {
        for (const line of lines) {
          registry.mask(line);
        }
      });

      const perLineMs = totalMs / 1000;
      // Assert <1ms/line (with 3x generous threshold)
      expect(perLineMs).toBeLessThan(3);
    });

    it("maskStringsDeep on log record in <1ms/record median", () => {
      const records: Record<string, unknown>[] = [];
      const secretValues = Object.values(BENCHMARK_SECRETS);
      for (let i = 0; i < 100; i++) {
        records.push({
          message: `Processing request with key ${secretValues[i % secretValues.length]}`,
          level: "info",
          timestamp: Date.now(),
          meta: { userId: "user-123", token: secretValues[(i + 1) % secretValues.length] },
        });
      }

      const totalMs = medianOfN(() => {
        for (const record of records) {
          maskStringsDeep(record, registry, true);
        }
      });

      const perRecordMs = totalMs / 100;
      // Assert <1ms/record (with 3x generous threshold)
      expect(perRecordMs).toBeLessThan(3);
    });
  });

  // =========================================================================
  // Streaming benchmark
  // =========================================================================

  describe("streaming masking", () => {
    it("masks 100 x 1KB chunks in <5ms/batch median", () => {
      // Build 100 chunks of ~1KB each, some containing secrets
      const secretValues = Object.values(BENCHMARK_SECRETS);
      const chunks: string[] = [];
      for (let i = 0; i < 100; i++) {
        const padding = "a".repeat(900);
        if (i % 10 === 0) {
          chunks.push(`${padding} key=${secretValues[i % secretValues.length]} `);
        } else {
          chunks.push(`${padding} safe-content-line-${i} `);
        }
      }

      const totalMs = medianOfN(() => {
        const masker = new StreamMasker(registry);
        for (const chunk of chunks) {
          masker.push(chunk);
        }
        masker.flush();
      });

      // Total for all 100 chunks should be <5ms (generous threshold: 15ms)
      expect(totalMs).toBeLessThan(15);
    });

    it("handles chunk boundary secrets without performance degradation", () => {
      const secret = BENCHMARK_SECRETS.OPENAI_KEY;
      const splitPoint = Math.floor(secret.length / 2);

      // 50 pairs of split-secret chunks
      const chunks: string[] = [];
      for (let i = 0; i < 50; i++) {
        chunks.push(`prefix-${i}-${secret.slice(0, splitPoint)}`);
        chunks.push(`${secret.slice(splitPoint)}-suffix-${i}`);
      }

      const totalMs = medianOfN(() => {
        const masker = new StreamMasker(registry);
        for (const chunk of chunks) {
          masker.push(chunk);
        }
        masker.flush();
      });

      // 100 chunks with boundary secrets: <15ms total
      expect(totalMs).toBeLessThan(15);
    });
  });

  // =========================================================================
  // Tool result benchmark
  // =========================================================================

  describe("tool result masking", () => {
    it("masks 50 tool result messages in <2ms/message median", () => {
      const secretValues = Object.values(BENCHMARK_SECRETS);
      const messages: Record<string, unknown>[] = [];
      for (let i = 0; i < 50; i++) {
        messages.push({
          role: "toolResult",
          content: [
            {
              type: "text",
              text: `Command output: token=${secretValues[i % secretValues.length]} status=ok`,
            },
          ],
          toolCallId: `call_${i}`,
          metadata: { duration: 42, key: secretValues[(i + 1) % secretValues.length] },
        });
      }

      const totalMs = medianOfN(() => {
        for (const msg of messages) {
          maskStringsDeep(msg, registry, false);
        }
      });

      const perMsgMs = totalMs / 50;
      // Assert <2ms/message (with 3x generous threshold)
      expect(perMsgMs).toBeLessThan(6);
    });
  });

  // =========================================================================
  // Scale benchmark
  // =========================================================================

  describe("scale benchmark", () => {
    it("100+ secrets x 100KB text completes within budget", () => {
      // Create a fresh registry with 120 secrets (triggers Aho-Corasick)
      SecretsRegistry.reset();
      const largeRegistry = SecretsRegistry.getInstance({ minLength: 8 });
      for (let i = 0; i < 120; i++) {
        largeRegistry.register(
          `secret_${i}`,
          `sk-scale-test-secret-value-${String(i).padStart(4, "0")}`,
        );
      }

      // Build 100KB text with secrets scattered throughout
      const padding = "x".repeat(512);
      const lines: string[] = [];
      for (let i = 0; i < 200; i++) {
        if (i % 20 === 0) {
          const secretIdx = (i / 20) % 120;
          lines.push(
            `${padding} key=sk-scale-test-secret-value-${String(secretIdx).padStart(4, "0")} ${padding}`,
          );
        } else {
          lines.push(`${padding} line-${i} ${padding}`);
        }
      }
      const largeText = lines.join("\n");
      expect(largeText.length).toBeGreaterThan(100 * 1024);

      const totalMs = medianOfN(() => {
        largeRegistry.mask(largeText);
      });

      // 100KB with 120 secrets: should complete in <50ms (generous)
      expect(totalMs).toBeLessThan(150);
    });

    it("empty registry has near-zero overhead", () => {
      SecretsRegistry.reset();
      const emptyRegistry = SecretsRegistry.getInstance({ minLength: 8 });

      const text = "x".repeat(100 * 1024);

      const totalMs = medianOfN(() => {
        emptyRegistry.mask(text);
      });

      // Empty registry on 100KB text: should be <1ms
      expect(totalMs).toBeLessThan(3);
    });
  });
});
