import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET,
  createAuthRateLimiter,
  normalizeRateLimitClientIp,
  type AuthRateLimiter,
} from "./auth-rate-limit.js";

describe("normalizeRateLimitClientIp", () => {
  it("normalizes IPv4-mapped IPv6", () => {
    expect(normalizeRateLimitClientIp("::ffff:192.168.1.1")).toBe("192.168.1.1");
  });

  it("returns 'unknown' for undefined", () => {
    expect(normalizeRateLimitClientIp(undefined)).toBe("unknown");
  });

  it("passes through plain IPv4", () => {
    expect(normalizeRateLimitClientIp("10.0.0.1")).toBe("10.0.0.1");
  });
});

describe("createAuthRateLimiter", () => {
  let limiter: AuthRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = createAuthRateLimiter({
      maxAttempts: 3,
      windowMs: 10_000,
      lockoutMs: 30_000,
      exemptLoopback: true,
      pruneIntervalMs: 0,
    });
  });

  afterEach(() => {
    limiter.dispose();
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const result = limiter.check("192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("tracks failures and blocks at limit", () => {
    limiter.recordFailure("192.168.1.1");
    limiter.recordFailure("192.168.1.1");
    expect(limiter.check("192.168.1.1").allowed).toBe(true);
    expect(limiter.check("192.168.1.1").remaining).toBe(1);

    limiter.recordFailure("192.168.1.1");
    const result = limiter.check("192.168.1.1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("lockout expires after lockoutMs", () => {
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure("192.168.1.1");
    }
    expect(limiter.check("192.168.1.1").allowed).toBe(false);

    vi.advanceTimersByTime(30_001);
    const result = limiter.check("192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("sliding window expires old attempts", () => {
    limiter.recordFailure("192.168.1.1");
    limiter.recordFailure("192.168.1.1");
    expect(limiter.check("192.168.1.1").remaining).toBe(1);

    vi.advanceTimersByTime(11_000);
    const result = limiter.check("192.168.1.1");
    expect(result.remaining).toBe(3);
  });

  it("isolates IPs independently", () => {
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");
    expect(limiter.check("10.0.0.1").allowed).toBe(false);
    expect(limiter.check("10.0.0.2").allowed).toBe(true);
  });

  it("isolates scopes independently", () => {
    limiter.recordFailure("192.168.1.1");
    limiter.recordFailure("192.168.1.1");
    limiter.recordFailure("192.168.1.1");
    expect(limiter.check("192.168.1.1").allowed).toBe(false);
    expect(limiter.check("192.168.1.1", AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET).allowed).toBe(true);
  });

  it("exempts loopback addresses", () => {
    for (let i = 0; i < 10; i++) {
      limiter.recordFailure("127.0.0.1");
    }
    expect(limiter.check("127.0.0.1").allowed).toBe(true);
  });

  it("exempts IPv6 loopback", () => {
    for (let i = 0; i < 10; i++) {
      limiter.recordFailure("::1");
    }
    expect(limiter.check("::1").allowed).toBe(true);
  });

  it("reset clears state for an IP", () => {
    limiter.recordFailure("192.168.1.1");
    limiter.recordFailure("192.168.1.1");
    limiter.reset("192.168.1.1");
    expect(limiter.check("192.168.1.1").remaining).toBe(3);
  });

  it("prune removes expired entries", () => {
    limiter.recordFailure("192.168.1.1");
    expect(limiter.size()).toBe(1);

    vi.advanceTimersByTime(11_000);
    limiter.prune();
    expect(limiter.size()).toBe(0);
  });

  it("prune keeps locked entries", () => {
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure("192.168.1.1");
    }
    expect(limiter.size()).toBe(1);

    vi.advanceTimersByTime(11_000);
    limiter.prune();
    expect(limiter.size()).toBe(1);
  });

  it("dispose clears all state", () => {
    limiter.recordFailure("192.168.1.1");
    limiter.dispose();
    expect(limiter.size()).toBe(0);
  });
});
