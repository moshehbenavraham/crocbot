import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { createRateLimiter, type RateLimiter } from "./rate-limit.js";

describe("rate-limit", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = createRateLimiter({ maxRequests: 3, windowMs: 10_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the limit", () => {
    const r1 = limiter.check("1.2.3.4");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r1.limit).toBe(3);

    const r2 = limiter.check("1.2.3.4");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check("1.2.3.4");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("denies requests that exceed the limit", () => {
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");

    const r4 = limiter.check("1.2.3.4");
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("tracks clients independently", () => {
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");

    // Different IP should be allowed
    const r = limiter.check("5.6.7.8");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("resets after the window expires", () => {
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");

    const denied = limiter.check("1.2.3.4");
    expect(denied.allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(10_001);

    const allowed = limiter.check("1.2.3.4");
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(2);
  });

  it("provides correct resetAt timestamp", () => {
    vi.setSystemTime(1_000_000);
    const r = limiter.check("1.2.3.4");
    // Window started at 1_000_000ms, resets at 1_000_000 + 10_000 = 1_010_000ms = 1010 seconds
    expect(r.resetAt).toBe(1010);
  });

  it("uses default config values", () => {
    const defaultLimiter = createRateLimiter();
    const r = defaultLimiter.check("1.2.3.4");
    expect(r.limit).toBe(60);
    expect(r.remaining).toBe(59);
  });

  it("reset() clears all state", () => {
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");

    limiter.reset();

    const r = limiter.check("1.2.3.4");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("cleans up stale windows", () => {
    limiter.check("old-ip");

    // Advance past cleanup interval
    vi.advanceTimersByTime(10_001);

    // This triggers cleanup
    limiter.check("new-ip");

    // old-ip window should be cleaned up; new request should start fresh
    const r = limiter.check("old-ip");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });
});
