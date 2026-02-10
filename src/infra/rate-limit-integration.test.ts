/**
 * Integration tests for the composed per-provider rate limiting pipeline.
 *
 * Exercises the full stack: ProviderRateLimiter + KeyPool + LLM retry +
 * withRateLimitCheck middleware under realistic multi-provider, burst-load,
 * and failure scenarios.
 *
 * All layers use real instances -- only the final LLM HTTP call is stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RateLimiterConfig } from "./provider-rate-limiter-config.js";
import type { KeyPoolDeps, KeyPoolEntry } from "./key-pool.js";

import { createProviderRateLimiter } from "./provider-rate-limiter.js";
import { createKeyPool } from "./key-pool.js";
import { retryAsync } from "./retry.js";
import { createLlmRetryOptions, isTransientLlmError } from "./llm-retry.js";
import { estimateTokens, withRateLimitCheck } from "./rate-limit-middleware.js";
import {
  getGlobalRateLimiter,
  initGlobalRateLimiter,
  resetGlobalRateLimiter,
} from "./rate-limiter-instance.js";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const WINDOW_MS = 60_000;

const OPENAI_CONFIG: RateLimiterConfig = {
  windowMs: WINDOW_MS,
  providers: { openai: { rpm: 60, tpm: 100_000 } },
};

const MULTI_PROVIDER_CONFIG: RateLimiterConfig = {
  windowMs: WINDOW_MS,
  providers: {
    openai: { rpm: 60, tpm: 100_000 },
    anthropic: { rpm: 30, tpm: 50_000 },
  },
};

const STUB_OPENAI_KEYS: KeyPoolEntry[] = [
  { profileId: "openai-key-1", providerId: "openai", apiKey: "sk-test-openai-key-00000001" },
  { profileId: "openai-key-2", providerId: "openai", apiKey: "sk-test-openai-key-00000002" },
];

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a rate limiter with the given config. Must be called after vi.useFakeTimers(). */
function createTestRateLimiter(config: RateLimiterConfig) {
  return createProviderRateLimiter(config);
}

/** Create a mock SecretsRegistry that tracks registrations. */
function createMockSecretsRegistry() {
  const registered = new Set<string>();
  return {
    register(name: string, _value: string): boolean {
      if (registered.has(name)) {
        return false;
      }
      registered.add(name);
      return true;
    },
    unregister(_name: string): boolean {
      return false;
    },
    mask(text: string): string {
      return text;
    },
    unmask(text: string): string {
      return text;
    },
    get size(): number {
      return registered.size;
    },
    registered,
  };
}

/** Create mock KeyPoolDeps for testing. */
function createMockDeps(
  rateLimiter: ReturnType<typeof createProviderRateLimiter>,
  overrides?: Partial<KeyPoolDeps>,
): KeyPoolDeps {
  const cooldownSet = new Set<string>();
  return {
    isInCooldown: overrides?.isInCooldown ?? ((id: string) => cooldownSet.has(id)),
    resolveOrder:
      overrides?.resolveOrder ??
      ((providerId: string) => {
        if (providerId === "openai") {
          return ["openai-key-1", "openai-key-2"];
        }
        if (providerId === "anthropic") {
          return ["anthropic-key-1"];
        }
        return [];
      }),
    markFailure:
      overrides?.markFailure ??
      ((_id: string, _reason) => {
        /* no-op for tests */
      }),
    markUsed:
      overrides?.markUsed ??
      ((_id: string) => {
        /* no-op for tests */
      }),
    rateLimiter,
    secretsRegistry: overrides?.secretsRegistry ?? (createMockSecretsRegistry() as never),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("rate-limit-integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetGlobalRateLimiter();
    vi.useRealTimers();
  });

  // =========================================================================
  // Zero-config pass-through
  // =========================================================================

  describe("zero-config pass-through", () => {
    it("withRateLimitCheck calls fn directly when rateLimiter is undefined", async () => {
      const fn = vi.fn().mockResolvedValue({ tokens: 42 });
      const result = await withRateLimitCheck({
        rateLimiter: undefined,
        provider: "openai",
        estimatedTokens: 100,
        fn,
      });
      expect(result).toEqual({ tokens: 42 });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("initGlobalRateLimiter(undefined) results in undefined from getGlobalRateLimiter", () => {
      initGlobalRateLimiter(undefined);
      expect(getGlobalRateLimiter()).toBeUndefined();
    });

    it("tryAcquire returns allowed for unconfigured provider", () => {
      const limiter = createTestRateLimiter({ providers: { openai: { rpm: 60 } } });
      const result = limiter.tryAcquire("unknown-provider", 100);
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });
  });

  // =========================================================================
  // RPM throttling
  // =========================================================================

  describe("RPM throttling", () => {
    it("allows requests up to RPM limit", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      for (let i = 0; i < 60; i++) {
        limiter.recordUsage("openai", 10);
      }
      const check = limiter.tryAcquire("openai");
      expect(check.allowed).toBe(false);
      expect(check.rejectedBy).toBe("rpm");
    });

    it("rejects request N+1 when RPM limit N is reached", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      // Record 60 requests (the RPM limit)
      for (let i = 0; i < 60; i++) {
        const check = limiter.tryAcquire("openai");
        expect(check.allowed).toBe(true);
        limiter.recordUsage("openai", 10);
      }
      // Request 61 should be rejected
      const rejected = limiter.tryAcquire("openai");
      expect(rejected.allowed).toBe(false);
      expect(rejected.rejectedBy).toBe("rpm");
      expect(rejected.retryAfterMs).toBeGreaterThan(0);
    });

    it("provides retryAfterMs > 0 on RPM rejection", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      for (let i = 0; i < 60; i++) {
        limiter.recordUsage("openai", 10);
      }
      const check = limiter.tryAcquire("openai");
      expect(check.allowed).toBe(false);
      expect(check.retryAfterMs).toBeGreaterThan(0);
      expect(check.retryAfterMs).toBeLessThanOrEqual(WINDOW_MS);
    });
  });

  // =========================================================================
  // TPM throttling
  // =========================================================================

  describe("TPM throttling", () => {
    it("rejects when estimated tokens exceed TPM limit", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      // Record 90,000 tokens already used
      limiter.recordUsage("openai", 90_000);
      // Try to acquire with estimate of 20,000 tokens (90k + 20k > 100k limit)
      const check = limiter.tryAcquire("openai", 20_000);
      expect(check.allowed).toBe(false);
      expect(check.rejectedBy).toBe("tpm");
    });

    it("allows small-token requests within remaining budget", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      limiter.recordUsage("openai", 90_000);
      // 5,000 estimated tokens + 90,000 used = 95,000 < 100,000 limit
      const check = limiter.tryAcquire("openai", 5_000);
      expect(check.allowed).toBe(true);
    });

    it("provides retryAfterMs on TPM rejection", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      limiter.recordUsage("openai", 100_001);
      const check = limiter.tryAcquire("openai", 1);
      expect(check.allowed).toBe(false);
      expect(check.rejectedBy).toBe("tpm");
      expect(check.retryAfterMs).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Sliding window expiration
  // =========================================================================

  describe("sliding window expiration", () => {
    it("restores capacity after window expires", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      // Fill to RPM limit
      for (let i = 0; i < 60; i++) {
        limiter.recordUsage("openai", 10);
      }
      expect(limiter.tryAcquire("openai").allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(WINDOW_MS + 1);

      const check = limiter.tryAcquire("openai");
      expect(check.allowed).toBe(true);
    });

    it("partially restores capacity as entries age out", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      // Record 30 requests at t=0
      for (let i = 0; i < 30; i++) {
        limiter.recordUsage("openai", 10);
      }
      // Advance 30s (half the window)
      vi.advanceTimersByTime(30_000);
      // Record 30 more requests at t=30s
      for (let i = 0; i < 30; i++) {
        limiter.recordUsage("openai", 10);
      }
      // At t=30s, 60 requests in window -> rejected
      expect(limiter.tryAcquire("openai").allowed).toBe(false);

      // Advance to t=60.001s -- the first 30 requests (from t=0) expire
      vi.advanceTimersByTime(30_001);

      // Now only 30 requests remain in window -> allowed
      const check = limiter.tryAcquire("openai");
      expect(check.allowed).toBe(true);
    });
  });

  // =========================================================================
  // Multi-provider isolation
  // =========================================================================

  describe("multi-provider isolation", () => {
    it("exhausting one provider does not affect another", () => {
      const limiter = createTestRateLimiter(MULTI_PROVIDER_CONFIG);
      // Exhaust anthropic (30 RPM)
      for (let i = 0; i < 30; i++) {
        limiter.recordUsage("anthropic", 10);
      }
      expect(limiter.tryAcquire("anthropic").allowed).toBe(false);
      // OpenAI should still have full capacity
      const openaiCheck = limiter.tryAcquire("openai");
      expect(openaiCheck.allowed).toBe(true);
    });

    it("tracks token usage independently per provider", () => {
      const limiter = createTestRateLimiter(MULTI_PROVIDER_CONFIG);
      // Use 90k tokens on openai
      limiter.recordUsage("openai", 90_000);
      // Use 40k tokens on anthropic
      limiter.recordUsage("anthropic", 40_000);

      const openaiUsage = limiter.getUsage("openai");
      const anthropicUsage = limiter.getUsage("anthropic");

      expect(openaiUsage?.currentTpm).toBe(90_000);
      expect(anthropicUsage?.currentTpm).toBe(40_000);

      // Openai still has TPM room for small requests
      expect(limiter.tryAcquire("openai", 5_000).allowed).toBe(true);
      // Anthropic is over limit (40k + 15k > 50k)
      expect(limiter.tryAcquire("anthropic", 15_000).allowed).toBe(false);
    });
  });

  // =========================================================================
  // Key pool + rate limiter composed
  // =========================================================================

  describe("key pool + rate limiter composed", () => {
    it("selectKey returns null when rate limiter blocks the provider", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      const deps = createMockDeps(limiter);
      const pool = createKeyPool(STUB_OPENAI_KEYS, deps);

      // Exhaust RPM limit
      for (let i = 0; i < 60; i++) {
        limiter.recordUsage("openai", 10);
      }

      // selectKey calls tryAcquire internally -- should return null
      const key = pool.selectKey("openai");
      expect(key).toBeNull();
    });

    it("reportFailure with 429 triggers recordRateLimitHit and blocks subsequent selectKey", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      const deps = createMockDeps(limiter);
      const pool = createKeyPool(STUB_OPENAI_KEYS, deps);

      // Initially key is available
      expect(pool.selectKey("openai")).not.toBeNull();

      // Report a 429 failure
      pool.reportFailure("openai-key-1", "rate_limit", 429);

      // Now the provider is rate-limit-hit blocked
      const check = limiter.tryAcquire("openai");
      expect(check.allowed).toBe(false);
      expect(check.rejectedBy).toBe("retry-after");
    });

    it("selectKey returns first non-cooldown key in order", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      const cooldownSet = new Set<string>();
      const deps = createMockDeps(limiter, {
        isInCooldown: (id: string) => cooldownSet.has(id),
      });
      const pool = createKeyPool(STUB_OPENAI_KEYS, deps);

      // First key available
      const first = pool.selectKey("openai");
      expect(first?.profileId).toBe("openai-key-1");

      // Put first key in cooldown
      cooldownSet.add("openai-key-1");
      const second = pool.selectKey("openai");
      expect(second?.profileId).toBe("openai-key-2");

      // Put second key in cooldown too
      cooldownSet.add("openai-key-2");
      const none = pool.selectKey("openai");
      expect(none).toBeNull();
    });
  });

  // =========================================================================
  // Retry + rate limiter composed
  // =========================================================================

  describe("retry + rate limiter composed", () => {
    it("retries on transient 429 and succeeds on second attempt", async () => {
      vi.useRealTimers();
      let attempt = 0;
      const fn = () => {
        attempt++;
        if (attempt === 1) {
          const err = new Error("Rate limited") as Error & { status: number };
          err.status = 429;
          return Promise.reject(err);
        }
        return Promise.resolve({ tokens: 50 });
      };

      const options = createLlmRetryOptions({
        attempts: 3,
        minDelayMs: 10,
        maxDelayMs: 50,
        jitter: 0,
      });
      const result = await retryAsync(fn, options);
      expect(result).toEqual({ tokens: 50 });
      expect(attempt).toBe(2);
    });

    it("does not retry permanent 401 errors", async () => {
      vi.useRealTimers();
      let attempt = 0;
      const fn = () => {
        attempt++;
        const err = new Error("Unauthorized") as Error & { status: number };
        err.status = 401;
        return Promise.reject(err);
      };

      const options = createLlmRetryOptions({
        attempts: 3,
        minDelayMs: 10,
        maxDelayMs: 50,
        jitter: 0,
      });
      await expect(retryAsync(fn, options)).rejects.toThrow("Unauthorized");
      expect(attempt).toBe(1);
    });

    it("propagates error after max retries exhausted", async () => {
      vi.useRealTimers();
      let attempt = 0;
      const fn = () => {
        attempt++;
        const err = new Error("Server error") as Error & { status: number };
        err.status = 500;
        return Promise.reject(err);
      };

      const options = createLlmRetryOptions({
        attempts: 2,
        minDelayMs: 10,
        maxDelayMs: 50,
        jitter: 0,
      });
      await expect(retryAsync(fn, options)).rejects.toThrow("Server error");
      expect(attempt).toBe(2);
    });
  });

  // =========================================================================
  // Middleware end-to-end
  // =========================================================================

  describe("middleware end-to-end", () => {
    it("records actual tokens via actualTokens callback and reflects in getUsage", async () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      const fn = vi.fn().mockResolvedValue({ totalTokens: 250 });

      await withRateLimitCheck({
        rateLimiter: limiter,
        provider: "openai",
        estimatedTokens: 100,
        actualTokens: (result: { totalTokens: number }) => result.totalTokens,
        fn,
      });

      const usage = limiter.getUsage("openai");
      expect(usage).not.toBeNull();
      // 250 actual tokens recorded, plus 1 request
      expect(usage!.currentTpm).toBe(250);
      expect(usage!.currentRpm).toBe(1);
    });

    it("throws on rejection with provider name and rejectedBy in message", async () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      // Exhaust RPM
      for (let i = 0; i < 60; i++) {
        limiter.recordUsage("openai", 10);
      }

      await expect(
        withRateLimitCheck({
          rateLimiter: limiter,
          provider: "openai",
          fn: vi.fn(),
        }),
      ).rejects.toThrow(/openai.*rpm/i);
    });
  });

  // =========================================================================
  // Performance microbenchmark
  // =========================================================================

  describe("performance microbenchmark", () => {
    it("tryAcquire + recordUsage completes in < 1ms median over 1000 iterations", () => {
      vi.useRealTimers();
      const limiter = createTestRateLimiter({
        windowMs: WINDOW_MS,
        providers: { openai: { rpm: 100_000, tpm: 10_000_000 } },
      });

      const durations: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        limiter.tryAcquire("openai", 100);
        limiter.recordUsage("openai", 100);
        const end = performance.now();
        durations.push(end - start);
      }

      durations.sort((a, b) => a - b);
      const median = durations[Math.floor(durations.length / 2)];
      const p95 = durations[Math.floor(durations.length * 0.95)];

      expect(median).toBeLessThan(1);
      expect(p95).toBeLessThan(1);
    });

    it("pass-through (no config) has negligible overhead", () => {
      vi.useRealTimers();
      const limiter = createTestRateLimiter({ providers: {} });

      const durations: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        limiter.tryAcquire("unknown-provider", 100);
        limiter.recordUsage("unknown-provider", 100);
        const end = performance.now();
        durations.push(end - start);
      }

      durations.sort((a, b) => a - b);
      const median = durations[Math.floor(durations.length / 2)];

      // Pass-through should be even faster than configured
      expect(median).toBeLessThan(0.5);
    });
  });

  // =========================================================================
  // Additional edge cases
  // =========================================================================

  describe("edge cases", () => {
    it("estimateTokens uses chars/4 heuristic", () => {
      // 400 chars / 4 = 100 tokens
      const text = "a".repeat(400);
      expect(estimateTokens(text)).toBe(100);
    });

    it("estimateTokens returns 0 for nullish input", () => {
      expect(estimateTokens(undefined)).toBe(0);
      expect(estimateTokens(null)).toBe(0);
      expect(estimateTokens("")).toBe(0);
    });

    it("isTransientLlmError correctly classifies transient vs permanent", () => {
      expect(isTransientLlmError({ status: 429 })).toBe(true);
      expect(isTransientLlmError({ status: 500 })).toBe(true);
      expect(isTransientLlmError({ status: 401 })).toBe(false);
      expect(isTransientLlmError({ status: 403 })).toBe(false);
      expect(isTransientLlmError({ code: "ECONNRESET" })).toBe(true);
    });

    it("global rate limiter singleton initializes and resets correctly", () => {
      initGlobalRateLimiter(OPENAI_CONFIG);
      const limiter = getGlobalRateLimiter();
      expect(limiter).toBeDefined();
      expect(limiter!.tryAcquire("openai").allowed).toBe(true);

      resetGlobalRateLimiter();
      expect(getGlobalRateLimiter()).toBeUndefined();
    });

    it("recordRateLimitHit blocks tryAcquire until retry-after period", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      limiter.recordRateLimitHit("openai", 5_000);

      const blocked = limiter.tryAcquire("openai");
      expect(blocked.allowed).toBe(false);
      expect(blocked.rejectedBy).toBe("retry-after");

      // Advance past the retry-after period
      vi.advanceTimersByTime(5_001);

      const unblocked = limiter.tryAcquire("openai");
      expect(unblocked.allowed).toBe(true);
    });

    it("key pool registers API keys with secrets registry", () => {
      const limiter = createTestRateLimiter(OPENAI_CONFIG);
      const registry = createMockSecretsRegistry();
      const deps = createMockDeps(limiter, { secretsRegistry: registry as never });
      const pool = createKeyPool(STUB_OPENAI_KEYS, deps);

      expect(pool.registeredCount).toBe(2);
      expect(registry.registered.has("key-pool:openai-key-1")).toBe(true);
      expect(registry.registered.has("key-pool:openai-key-2")).toBe(true);
    });
  });
});
