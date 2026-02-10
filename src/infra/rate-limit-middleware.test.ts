import { describe, expect, it, vi } from "vitest";

import type { ProviderRateLimiter, RateLimitCheckResult } from "./provider-rate-limiter-config.js";
import {
  createRateLimiterFromConfig,
  estimateTokens,
  logReject,
  logRetry,
  logThrottle,
  logUsageRecorded,
  withRateLimitCheck,
} from "./rate-limit-middleware.js";

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe("estimateTokens", () => {
  it("returns 0 for null/undefined/empty input", () => {
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates tokens using default divisor (chars / 4)", () => {
    // 12 chars / 4 = 3
    expect(estimateTokens("hello world!")).toBe(3);
  });

  it("rounds up via Math.ceil", () => {
    // 5 chars / 4 = 1.25 -> ceil = 2
    expect(estimateTokens("hello")).toBe(2);
  });

  it("returns at least 1 for non-empty input", () => {
    // 1 char / 4 = 0.25 -> ceil = 1, max(1, 1) = 1
    expect(estimateTokens("a")).toBe(1);
  });

  it("uses custom divisor when provided", () => {
    // 12 chars / 3 = 4
    expect(estimateTokens("hello world!", 3)).toBe(4);
  });

  it("uses custom divisor of 1 (1 token per char)", () => {
    expect(estimateTokens("abc", 1)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// withRateLimitCheck
// ---------------------------------------------------------------------------

function createMockRateLimiter(overrides?: {
  tryAcquire?: ReturnType<typeof vi.fn>;
  recordUsage?: ReturnType<typeof vi.fn>;
  recordRateLimitHit?: ReturnType<typeof vi.fn>;
  getUsage?: ReturnType<typeof vi.fn>;
  reset?: ReturnType<typeof vi.fn>;
}) {
  const tryAcquire =
    overrides?.tryAcquire ?? vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 });
  const recordUsage = overrides?.recordUsage ?? vi.fn();
  const recordRateLimitHit = overrides?.recordRateLimitHit ?? vi.fn();
  const getUsage = overrides?.getUsage ?? vi.fn().mockReturnValue(null);
  const reset = overrides?.reset ?? vi.fn();

  const limiter: ProviderRateLimiter = {
    tryAcquire,
    recordUsage,
    recordRateLimitHit,
    getUsage,
    reset,
  };

  return { limiter, tryAcquire, recordUsage, recordRateLimitHit, getUsage, reset };
}

describe("withRateLimitCheck", () => {
  it("passes through when no rate limiter is provided", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const result = await withRateLimitCheck({
      provider: "openai",
      fn,
    });
    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("calls tryAcquire before executing fn", async () => {
    const { limiter, tryAcquire } = createMockRateLimiter();
    const fn = vi.fn().mockResolvedValue("ok");

    await withRateLimitCheck({
      rateLimiter: limiter,
      provider: "openai",
      estimatedTokens: 100,
      fn,
    });

    expect(tryAcquire).toHaveBeenCalledWith("openai", 100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("throws when rate limiter rejects", async () => {
    const { limiter } = createMockRateLimiter({
      tryAcquire: vi.fn().mockReturnValue({
        allowed: false,
        retryAfterMs: 5000,
        rejectedBy: "rpm",
      } satisfies RateLimitCheckResult),
    });
    const fn = vi.fn();

    await expect(
      withRateLimitCheck({
        rateLimiter: limiter,
        provider: "openai",
        fn,
      }),
    ).rejects.toThrow("Rate limit exceeded for provider openai (rpm)");

    expect(fn).not.toHaveBeenCalled();
  });

  it("records actual token usage via actualTokens callback", async () => {
    const { limiter, recordUsage } = createMockRateLimiter();
    const fn = vi.fn().mockResolvedValue({ tokens: 42 });

    await withRateLimitCheck({
      rateLimiter: limiter,
      provider: "anthropic",
      fn,
      actualTokens: (result: { tokens: number }) => result.tokens,
    });

    expect(recordUsage).toHaveBeenCalledWith("anthropic", 42);
  });

  it("does not record usage when actualTokens returns undefined", async () => {
    const { limiter, recordUsage } = createMockRateLimiter();
    const fn = vi.fn().mockResolvedValue({ tokens: undefined });

    await withRateLimitCheck({
      rateLimiter: limiter,
      provider: "openai",
      fn,
      actualTokens: () => undefined,
    });

    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("does not record usage when actualTokens returns 0", async () => {
    const { limiter, recordUsage } = createMockRateLimiter();
    const fn = vi.fn().mockResolvedValue({});

    await withRateLimitCheck({
      rateLimiter: limiter,
      provider: "openai",
      fn,
      actualTokens: () => 0,
    });

    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("does not record usage when no actualTokens callback provided", async () => {
    const { limiter, recordUsage } = createMockRateLimiter();
    const fn = vi.fn().mockResolvedValue("ok");

    await withRateLimitCheck({
      rateLimiter: limiter,
      provider: "openai",
      fn,
    });

    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("propagates fn errors without recording usage", async () => {
    const { limiter, recordUsage } = createMockRateLimiter();
    const fn = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(
      withRateLimitCheck({
        rateLimiter: limiter,
        provider: "openai",
        fn,
        actualTokens: () => 100,
      }),
    ).rejects.toThrow("network error");

    expect(recordUsage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Structured log helpers (smoke tests -- verify they don't throw)
// ---------------------------------------------------------------------------

describe("log helpers", () => {
  it("logThrottle does not throw", () => {
    expect(() =>
      logThrottle({ provider: "openai", rejectedBy: "rpm", retryAfterMs: 5000 }),
    ).not.toThrow();
  });

  it("logThrottle with context does not throw", () => {
    expect(() =>
      logThrottle({
        provider: "openai",
        rejectedBy: "tpm",
        retryAfterMs: 3000,
        context: "model-fallback",
      }),
    ).not.toThrow();
  });

  it("logThrottle with role does not throw", () => {
    expect(() =>
      logThrottle({
        provider: "openai",
        rejectedBy: "rpm",
        retryAfterMs: 5000,
        role: "utility",
      }),
    ).not.toThrow();
  });

  it("logReject does not throw", () => {
    expect(() =>
      logReject({ provider: "anthropic", rejectedBy: "rpm", retryAfterMs: 1000 }),
    ).not.toThrow();
  });

  it("logReject with role does not throw", () => {
    expect(() =>
      logReject({
        provider: "anthropic",
        rejectedBy: "rpm",
        retryAfterMs: 1000,
        role: "reasoning",
      }),
    ).not.toThrow();
  });

  it("logRetry does not throw", () => {
    expect(() => logRetry({ provider: "openai", retryAfterMs: 60000 })).not.toThrow();
  });

  it("logRetry with role does not throw", () => {
    expect(() =>
      logRetry({ provider: "openai", retryAfterMs: 60000, role: "utility" }),
    ).not.toThrow();
  });

  it("logUsageRecorded does not throw", () => {
    expect(() => logUsageRecorded({ provider: "openai", tokens: 500 })).not.toThrow();
  });

  it("logUsageRecorded with role does not throw", () => {
    expect(() =>
      logUsageRecorded({ provider: "openai", tokens: 500, role: "utility" }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// withRateLimitCheck role pass-through
// ---------------------------------------------------------------------------

describe("withRateLimitCheck role pass-through", () => {
  it("accepts role parameter without affecting fn execution", async () => {
    const { limiter } = createMockRateLimiter();
    const fn = vi.fn().mockResolvedValue("result");

    const result = await withRateLimitCheck({
      rateLimiter: limiter,
      provider: "openai",
      role: "utility",
      fn,
    });

    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("works identically to current behavior when role is omitted", async () => {
    const { limiter, tryAcquire } = createMockRateLimiter();
    const fn = vi.fn().mockResolvedValue("ok");

    await withRateLimitCheck({
      rateLimiter: limiter,
      provider: "openai",
      estimatedTokens: 50,
      fn,
    });

    expect(tryAcquire).toHaveBeenCalledWith("openai", 50);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("passes role through when rate limiter rejects", async () => {
    const { limiter } = createMockRateLimiter({
      tryAcquire: vi.fn().mockReturnValue({
        allowed: false,
        retryAfterMs: 5000,
        rejectedBy: "rpm",
      } satisfies RateLimitCheckResult),
    });
    const fn = vi.fn();

    await expect(
      withRateLimitCheck({
        rateLimiter: limiter,
        provider: "openai",
        role: "utility",
        fn,
      }),
    ).rejects.toThrow("Rate limit exceeded");

    expect(fn).not.toHaveBeenCalled();
  });

  it("passes role through to usage recording", async () => {
    const { limiter, recordUsage } = createMockRateLimiter();
    const fn = vi.fn().mockResolvedValue({ tokens: 42 });

    await withRateLimitCheck({
      rateLimiter: limiter,
      provider: "anthropic",
      role: "reasoning",
      fn,
      actualTokens: (result: { tokens: number }) => result.tokens,
    });

    expect(recordUsage).toHaveBeenCalledWith("anthropic", 42);
  });

  it("passes through when no rate limiter is provided regardless of role", async () => {
    const fn = vi.fn().mockResolvedValue("result");

    const result = await withRateLimitCheck({
      provider: "openai",
      role: "utility",
      fn,
    });

    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// createRateLimiterFromConfig
// ---------------------------------------------------------------------------

describe("createRateLimiterFromConfig", () => {
  it("returns undefined when config is undefined", () => {
    expect(createRateLimiterFromConfig(undefined)).toBeUndefined();
  });

  it("returns a rate limiter when config is provided", () => {
    const limiter = createRateLimiterFromConfig({
      defaults: { rpm: 60 },
    });
    expect(limiter).toBeDefined();
    expect(typeof limiter!.tryAcquire).toBe("function");
    expect(typeof limiter!.recordUsage).toBe("function");
    expect(typeof limiter!.recordRateLimitHit).toBe("function");
    expect(typeof limiter!.getUsage).toBe("function");
    expect(typeof limiter!.reset).toBe("function");
  });

  it("returns a functioning rate limiter that enforces limits", () => {
    const limiter = createRateLimiterFromConfig({
      providers: { testprov: { rpm: 1 } },
    });
    expect(limiter).toBeDefined();

    const first = limiter!.tryAcquire("testprov");
    expect(first.allowed).toBe(true);

    // Record one request
    limiter!.recordUsage("testprov", 0);

    // Second should be rejected (RPM = 1)
    const second = limiter!.tryAcquire("testprov");
    expect(second.allowed).toBe(false);
    expect(second.rejectedBy).toBe("rpm");
  });
});
