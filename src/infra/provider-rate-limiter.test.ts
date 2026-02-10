import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveProviderConfig } from "./provider-rate-limiter-config.js";
import { createProviderRateLimiter } from "./provider-rate-limiter.js";

import type { ProviderRateLimiter } from "./provider-rate-limiter-config.js";

// ---------------------------------------------------------------------------
// T016: Zero-config pass-through, configuration resolution, provider ID normalization
// ---------------------------------------------------------------------------

describe("resolveProviderConfig", () => {
  it("returns null when no config is provided", () => {
    expect(resolveProviderConfig("openai")).toBeNull();
  });

  it("returns null when config has no defaults and no provider entry", () => {
    expect(resolveProviderConfig("openai", { providers: {} })).toBeNull();
  });

  it("returns null when both RPM and TPM resolve to 0", () => {
    expect(resolveProviderConfig("openai", { defaults: { rpm: 0, tpm: 0 } })).toBeNull();
  });

  it("uses defaults when no provider-specific config exists", () => {
    const result = resolveProviderConfig("openai", { defaults: { rpm: 60, tpm: 100_000 } });
    expect(result).toEqual({ rpm: 60, tpm: 100_000 });
  });

  it("uses provider-specific config over defaults", () => {
    const result = resolveProviderConfig("openai", {
      defaults: { rpm: 60, tpm: 100_000 },
      providers: { openai: { rpm: 120, tpm: 200_000 } },
    });
    expect(result).toEqual({ rpm: 120, tpm: 200_000 });
  });

  it("merges provider-specific with defaults for missing fields", () => {
    const result = resolveProviderConfig("openai", {
      defaults: { rpm: 60, tpm: 100_000 },
      providers: { openai: { rpm: 120 } },
    });
    expect(result).toEqual({ rpm: 120, tpm: 100_000 });
  });

  it("normalizes provider ID case for lookup", () => {
    const result = resolveProviderConfig("OpenAI", {
      providers: { openai: { rpm: 60 } },
    });
    expect(result).toEqual({ rpm: 60, tpm: 0 });
  });

  it("handles mixed-case provider keys in config", () => {
    const result = resolveProviderConfig("openai", {
      providers: { OpenAI: { rpm: 60 } },
    });
    expect(result).toEqual({ rpm: 60, tpm: 0 });
  });

  it("clamps negative values to 0", () => {
    const result = resolveProviderConfig("openai", { defaults: { rpm: -5, tpm: 100 } });
    expect(result).toEqual({ rpm: 0, tpm: 100 });
  });
});

describe("provider-rate-limiter", () => {
  let limiter: ProviderRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Zero-config pass-through
  // -------------------------------------------------------------------------

  describe("zero-config pass-through", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter();
    });

    it("returns allowed with no config at all", () => {
      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it("returns allowed for unconfigured provider with empty config", () => {
      limiter = createProviderRateLimiter({});
      const result = limiter.tryAcquire("openai", 1000);
      expect(result.allowed).toBe(true);
    });

    it("returns null from getUsage for unconfigured provider", () => {
      expect(limiter.getUsage("openai")).toBeNull();
    });

    it("does not create state for unconfigured providers", () => {
      limiter.tryAcquire("openai");
      limiter.tryAcquire("openai");
      limiter.tryAcquire("openai");
      // getUsage returns null because no state was created
      expect(limiter.getUsage("openai")).toBeNull();
    });

    it("recordUsage is a no-op for unconfigured providers", () => {
      limiter.recordUsage("openai", 500);
      expect(limiter.getUsage("openai")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Provider ID normalization
  // -------------------------------------------------------------------------

  describe("provider ID normalization", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 3 } },
      });
    });

    it("treats mixed-case provider IDs as the same provider", () => {
      limiter.recordUsage("OpenAI", 100);
      limiter.recordUsage("OPENAI", 100);
      limiter.recordUsage("openai", 100);
      const result = limiter.tryAcquire("Openai");
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("rpm");
    });
  });

  // -------------------------------------------------------------------------
  // T017: RPM enforcement
  // -------------------------------------------------------------------------

  describe("RPM enforcement", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 3 } },
        windowMs: 10_000,
      });
    });

    it("allows requests under the RPM limit", () => {
      const r1 = limiter.tryAcquire("openai");
      expect(r1.allowed).toBe(true);
      limiter.recordUsage("openai", 100);

      const r2 = limiter.tryAcquire("openai");
      expect(r2.allowed).toBe(true);
      limiter.recordUsage("openai", 100);

      const r3 = limiter.tryAcquire("openai");
      expect(r3.allowed).toBe(true);
    });

    it("rejects requests at the RPM limit", () => {
      limiter.recordUsage("openai", 100);
      limiter.recordUsage("openai", 100);
      limiter.recordUsage("openai", 100);

      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("rpm");
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("restores capacity after window expires", () => {
      limiter.recordUsage("openai", 100);
      limiter.recordUsage("openai", 100);
      limiter.recordUsage("openai", 100);

      const denied = limiter.tryAcquire("openai");
      expect(denied.allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(10_001);

      const allowed = limiter.tryAcquire("openai");
      expect(allowed.allowed).toBe(true);
    });

    it("provides accurate retryAfterMs when rejected", () => {
      vi.setSystemTime(1_000_000);
      limiter.recordUsage("openai", 100);

      vi.advanceTimersByTime(1000);
      limiter.recordUsage("openai", 100);

      vi.advanceTimersByTime(1000);
      limiter.recordUsage("openai", 100);

      vi.advanceTimersByTime(1000);
      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(false);
      // Oldest entry was at 1_000_000, window is 10_000ms
      // retryAfterMs = 1_000_000 + 10_000 - 1_003_000 = 7_000
      expect(result.retryAfterMs).toBe(7_000);
    });

    it("allows RPM-only config (TPM unlimited)", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 2 } },
      });
      limiter.recordUsage("openai", 1_000_000);
      limiter.recordUsage("openai", 1_000_000);

      // RPM=2, both slots used -> reject
      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("rpm");
    });
  });

  // -------------------------------------------------------------------------
  // T018: TPM enforcement, dual-limit interaction, retryAfterMs accuracy
  // -------------------------------------------------------------------------

  describe("TPM enforcement", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter({
        providers: { openai: { tpm: 1000 } },
        windowMs: 10_000,
      });
    });

    it("allows requests when TPM usage is below limit", () => {
      limiter.recordUsage("openai", 500);
      const result = limiter.tryAcquire("openai", 400);
      expect(result.allowed).toBe(true);
    });

    it("rejects when estimated tokens would exceed TPM limit", () => {
      limiter.recordUsage("openai", 500);
      const result = limiter.tryAcquire("openai", 600);
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("tpm");
    });

    it("allows when no estimated tokens provided and under limit", () => {
      limiter.recordUsage("openai", 999);
      // estimatedTokens defaults to 0, so currentTpm + 0 <= 1000
      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(true);
    });

    it("rejects when current TPM already exceeds limit", () => {
      limiter.recordUsage("openai", 1001);
      const result = limiter.tryAcquire("openai", 1);
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("tpm");
    });

    it("restores TPM capacity after window expires", () => {
      limiter.recordUsage("openai", 900);

      const denied = limiter.tryAcquire("openai", 200);
      expect(denied.allowed).toBe(false);

      vi.advanceTimersByTime(10_001);

      const allowed = limiter.tryAcquire("openai", 200);
      expect(allowed.allowed).toBe(true);
    });

    it("handles TPM-only config (RPM unlimited)", () => {
      // Record many requests but stay under TPM
      for (let i = 0; i < 100; i++) {
        limiter.recordUsage("openai", 5);
      }
      // 100 requests * 5 tokens = 500 < 1000 TPM limit
      const result = limiter.tryAcquire("openai", 400);
      expect(result.allowed).toBe(true);
    });

    it("handles very large token values without overflow", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { tpm: 2_000_000 } },
      });
      limiter.recordUsage("openai", 1_500_000);
      const result = limiter.tryAcquire("openai", 600_000);
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("tpm");
    });
  });

  describe("dual-limit interaction", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 5, tpm: 1000 } },
        windowMs: 10_000,
      });
    });

    it("allows when both RPM and TPM are under limits", () => {
      limiter.recordUsage("openai", 200);
      const result = limiter.tryAcquire("openai", 200);
      expect(result.allowed).toBe(true);
    });

    it("rejects when RPM allows but TPM rejects", () => {
      // Only 1 request so RPM (5) is fine, but tokens exceed TPM (1000)
      limiter.recordUsage("openai", 900);
      const result = limiter.tryAcquire("openai", 200);
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("tpm");
    });

    it("rejects when TPM allows but RPM rejects", () => {
      // 5 requests with small tokens
      for (let i = 0; i < 5; i++) {
        limiter.recordUsage("openai", 10);
      }
      // RPM=5, all 5 used, but TPM=50 << 1000
      const result = limiter.tryAcquire("openai", 10);
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("rpm");
    });

    it("checks RPM before TPM", () => {
      // Exceed both limits
      for (let i = 0; i < 5; i++) {
        limiter.recordUsage("openai", 300);
      }
      // RPM=5 (full), TPM=1500 (over 1000)
      const result = limiter.tryAcquire("openai", 100);
      expect(result.allowed).toBe(false);
      // RPM is checked first
      expect(result.rejectedBy).toBe("rpm");
    });
  });

  // -------------------------------------------------------------------------
  // T019: recordRateLimitHit, multi-provider, getUsage, reset, cleanup
  // -------------------------------------------------------------------------

  describe("recordRateLimitHit", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 10, tpm: 100_000 } },
        windowMs: 10_000,
      });
    });

    it("blocks tryAcquire until retry-after expires", () => {
      limiter.recordRateLimitHit("openai", 5000);

      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("retry-after");
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(5000);
    });

    it("allows after retry-after period expires", () => {
      limiter.recordRateLimitHit("openai", 5000);

      vi.advanceTimersByTime(5001);

      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(true);
    });

    it("uses windowMs as default when retryAfterMs not provided", () => {
      limiter.recordRateLimitHit("openai");

      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(10_000);
    });

    it("creates state for unconfigured providers on 429", () => {
      limiter.recordRateLimitHit("anthropic", 3000);

      const result = limiter.tryAcquire("anthropic");
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("retry-after");

      vi.advanceTimersByTime(3001);

      // After retry-after expires, unconfigured provider should pass through
      const allowed = limiter.tryAcquire("anthropic");
      expect(allowed.allowed).toBe(true);
    });

    it("shows retry-after active in getUsage", () => {
      limiter.recordRateLimitHit("openai", 5000);

      const stats = limiter.getUsage("openai");
      expect(stats).not.toBeNull();
      expect(stats!.isRetryAfterActive).toBe(true);

      vi.advanceTimersByTime(5001);

      const statsAfter = limiter.getUsage("openai");
      expect(statsAfter!.isRetryAfterActive).toBe(false);
    });
  });

  describe("multi-provider isolation", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter({
        providers: {
          openai: { rpm: 2 },
          anthropic: { rpm: 5 },
        },
        windowMs: 10_000,
      });
    });

    it("tracks providers independently", () => {
      limiter.recordUsage("openai", 100);
      limiter.recordUsage("openai", 100);

      const openaiResult = limiter.tryAcquire("openai");
      expect(openaiResult.allowed).toBe(false);

      // Anthropic should be unaffected
      const anthropicResult = limiter.tryAcquire("anthropic");
      expect(anthropicResult.allowed).toBe(true);
    });

    it("rate limit hit on one provider does not affect another", () => {
      limiter.recordRateLimitHit("openai", 5000);

      const openaiResult = limiter.tryAcquire("openai");
      expect(openaiResult.allowed).toBe(false);

      const anthropicResult = limiter.tryAcquire("anthropic");
      expect(anthropicResult.allowed).toBe(true);
    });
  });

  describe("getUsage", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 10, tpm: 1000 } },
        windowMs: 10_000,
      });
    });

    it("returns zero stats before any usage", () => {
      const stats = limiter.getUsage("openai");
      expect(stats).toEqual({
        currentRpm: 0,
        rpmLimit: 10,
        rpmUtilization: 0,
        currentTpm: 0,
        tpmLimit: 1000,
        tpmUtilization: 0,
        isRetryAfterActive: false,
      });
    });

    it("returns accurate stats after usage", () => {
      limiter.recordUsage("openai", 500);
      limiter.recordUsage("openai", 300);

      const stats = limiter.getUsage("openai");
      expect(stats).not.toBeNull();
      expect(stats!.currentRpm).toBe(2);
      expect(stats!.currentTpm).toBe(800);
      expect(stats!.rpmUtilization).toBe(20);
      expect(stats!.tpmUtilization).toBe(80);
    });

    it("reflects expired entries dropping out of window", () => {
      limiter.recordUsage("openai", 500);

      vi.advanceTimersByTime(10_001);

      const stats = limiter.getUsage("openai");
      expect(stats!.currentRpm).toBe(0);
      expect(stats!.currentTpm).toBe(0);
    });

    it("returns null for unknown providers with no limits configured", () => {
      expect(limiter.getUsage("unknown")).toBeNull();
    });

    it("caps utilization at 100%", () => {
      for (let i = 0; i < 15; i++) {
        limiter.recordUsage("openai", 100);
      }
      const stats = limiter.getUsage("openai");
      expect(stats!.rpmUtilization).toBe(100);
    });
  });

  describe("reset", () => {
    beforeEach(() => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 2 } },
        windowMs: 10_000,
      });
    });

    it("clears all state", () => {
      limiter.recordUsage("openai", 100);
      limiter.recordUsage("openai", 100);

      const denied = limiter.tryAcquire("openai");
      expect(denied.allowed).toBe(false);

      limiter.reset();

      const allowed = limiter.tryAcquire("openai");
      expect(allowed.allowed).toBe(true);
    });

    it("clears retry-after state", () => {
      limiter.recordRateLimitHit("openai", 60_000);

      const denied = limiter.tryAcquire("openai");
      expect(denied.allowed).toBe(false);

      limiter.reset();

      const allowed = limiter.tryAcquire("openai");
      expect(allowed.allowed).toBe(true);
    });

    it("clears getUsage state", () => {
      limiter.recordUsage("openai", 100);
      limiter.reset();

      // After reset, getUsage returns zero stats (config still resolved)
      const stats = limiter.getUsage("openai");
      expect(stats).toEqual({
        currentRpm: 0,
        rpmLimit: 2,
        rpmUtilization: 0,
        currentTpm: 0,
        tpmLimit: 0,
        tpmUtilization: 0,
        isRetryAfterActive: false,
      });
    });
  });

  describe("periodic cleanup", () => {
    it("prunes expired entries after cleanup interval", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 100, tpm: 100_000 } },
        windowMs: 10_000,
      });

      // Record some usage
      for (let i = 0; i < 50; i++) {
        limiter.recordUsage("openai", 100);
      }

      // Advance past the window so entries expire
      vi.advanceTimersByTime(10_001);

      // The next tryAcquire triggers cleanup since windowMs/4 = 2500ms has passed
      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(true);

      // Usage should show 0 since all entries expired
      const stats = limiter.getUsage("openai");
      expect(stats!.currentRpm).toBe(0);
      expect(stats!.currentTpm).toBe(0);
    });

    it("does not cleanup within the cleanup interval", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 100 } },
        windowMs: 10_000,
      });

      limiter.recordUsage("openai", 100);

      // Advance less than cleanup interval (windowMs/4 = 2500ms)
      vi.advanceTimersByTime(1000);

      // This call should not trigger cleanup (interval not reached)
      limiter.recordUsage("openai", 100);

      const stats = limiter.getUsage("openai");
      expect(stats!.currentRpm).toBe(2);
    });
  });

  describe("rapid sequential calls", () => {
    it("counts multiple calls within the same millisecond", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 5 } },
      });

      // All in the same tick
      limiter.recordUsage("openai", 10);
      limiter.recordUsage("openai", 10);
      limiter.recordUsage("openai", 10);
      limiter.recordUsage("openai", 10);
      limiter.recordUsage("openai", 10);

      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(false);
      expect(result.rejectedBy).toBe("rpm");
    });
  });

  describe("configuration defaults cascade", () => {
    it("applies defaults to all providers without overrides", () => {
      limiter = createProviderRateLimiter({
        defaults: { rpm: 5 },
        windowMs: 10_000,
      });

      for (let i = 0; i < 5; i++) {
        limiter.recordUsage("openai", 10);
      }
      expect(limiter.tryAcquire("openai").allowed).toBe(false);

      for (let i = 0; i < 5; i++) {
        limiter.recordUsage("anthropic", 10);
      }
      expect(limiter.tryAcquire("anthropic").allowed).toBe(false);
    });

    it("provider overrides take precedence over defaults", () => {
      limiter = createProviderRateLimiter({
        defaults: { rpm: 5 },
        providers: { openai: { rpm: 2 } },
        windowMs: 10_000,
      });

      limiter.recordUsage("openai", 10);
      limiter.recordUsage("openai", 10);
      expect(limiter.tryAcquire("openai").allowed).toBe(false);

      // Anthropic uses defaults (rpm=5), so 2 requests is fine
      limiter.recordUsage("anthropic", 10);
      limiter.recordUsage("anthropic", 10);
      expect(limiter.tryAcquire("anthropic").allowed).toBe(true);
    });
  });

  describe("empty window edge cases", () => {
    it("retryAfterMs is 0 when window is empty after full expiry", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 1 } },
        windowMs: 10_000,
      });

      limiter.recordUsage("openai", 100);

      // Expire the window
      vi.advanceTimersByTime(10_001);

      const result = limiter.tryAcquire("openai");
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it("handles zero RPM config as unlimited", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 0, tpm: 1000 } },
      });

      // With rpm=0, only tpm matters. rpm resolves to null (no enforcement)
      // Actually rpm:0 + tpm:1000 -> resolveProviderConfig returns {rpm:0, tpm:1000}
      for (let i = 0; i < 100; i++) {
        limiter.recordUsage("openai", 5);
      }
      // 100 requests but RPM is 0 (unlimited), and TPM = 500 < 1000
      const result = limiter.tryAcquire("openai", 100);
      expect(result.allowed).toBe(true);
    });

    it("handles zero TPM config as unlimited", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 5, tpm: 0 } },
      });

      limiter.recordUsage("openai", 1_000_000);
      // RPM = 1 < 5, TPM = 0 (unlimited)
      const result = limiter.tryAcquire("openai", 1_000_000);
      expect(result.allowed).toBe(true);
    });
  });

  describe("custom windowMs", () => {
    it("uses custom window duration", () => {
      limiter = createProviderRateLimiter({
        providers: { openai: { rpm: 2 } },
        windowMs: 5000,
      });

      limiter.recordUsage("openai", 100);
      limiter.recordUsage("openai", 100);

      expect(limiter.tryAcquire("openai").allowed).toBe(false);

      // Advance past 5s window
      vi.advanceTimersByTime(5001);

      expect(limiter.tryAcquire("openai").allowed).toBe(true);
    });
  });
});
