/**
 * Lightweight in-memory rate limiter for the gateway HTTP server.
 *
 * Uses a fixed-window counter per client IP. Windows are automatically
 * cleaned up on each request to prevent unbounded memory growth.
 */

export interface RateLimitConfig {
  /** Max requests per window. Default: 60. */
  maxRequests?: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
}

interface WindowEntry {
  count: number;
  /** Timestamp (ms) when this window started. */
  start: number;
}

const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Unix timestamp (seconds) when the current window resets. */
  resetAt: number;
  /** The configured limit. */
  limit: number;
}

export interface RateLimiter {
  /** Check and consume one request for the given key. */
  check(key: string): RateLimitResult;
  /** Reset all state (useful for tests). */
  reset(): void;
}

/**
 * Create a rate limiter instance.
 *
 * Each call to `check(key)` increments the counter for that key within
 * the current window. If the counter exceeds `maxRequests`, the request
 * is denied until the window resets.
 *
 * Stale windows are pruned on each `check` call so memory stays bounded
 * by the number of unique IPs seen within a single window.
 */
export function createRateLimiter(config?: RateLimitConfig): RateLimiter {
  const maxRequests = config?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
  const windows = new Map<string, WindowEntry>();

  let lastCleanup = Date.now();

  function cleanup(now: number): void {
    // Only run cleanup every windowMs to avoid O(n) on every request
    if (now - lastCleanup < windowMs) return;
    lastCleanup = now;
    for (const [key, entry] of windows) {
      if (now - entry.start >= windowMs) {
        windows.delete(key);
      }
    }
  }

  function check(key: string): RateLimitResult {
    const now = Date.now();
    cleanup(now);

    const existing = windows.get(key);

    if (!existing || now - existing.start >= windowMs) {
      // New window
      const entry: WindowEntry = { count: 1, start: now };
      windows.set(key, entry);
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: Math.ceil((now + windowMs) / 1000),
        limit: maxRequests,
      };
    }

    existing.count++;
    const resetAt = Math.ceil((existing.start + windowMs) / 1000);

    if (existing.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: maxRequests,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - existing.count,
      resetAt,
      limit: maxRequests,
    };
  }

  function reset(): void {
    windows.clear();
    lastCleanup = Date.now();
  }

  return { check, reset };
}
