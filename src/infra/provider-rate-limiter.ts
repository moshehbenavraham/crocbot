/**
 * Per-provider sliding window rate limiter.
 *
 * Enforces RPM (requests per minute) and TPM (tokens per minute) limits using
 * a sliding window log algorithm. Each provider maintains independent windows.
 * Zero overhead when no limits are configured (pass-through mode).
 *
 * Created via `createProviderRateLimiter(config)`.
 */

import type {
  ProviderRateLimitState,
  ProviderRateLimiter,
  ProviderUsageStats,
  RateLimitCheckResult,
  RateLimiterConfig,
  ResolvedProviderConfig,
  WindowEntry,
} from "./provider-rate-limiter-config.js";

import { resolveProviderConfig } from "./provider-rate-limiter-config.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 60_000;
// ---------------------------------------------------------------------------
// Sliding window log helpers
// ---------------------------------------------------------------------------

/** Sum all entry values within the window [cutoff, now]. */
function sumInWindow(entries: WindowEntry[], cutoff: number): number {
  let total = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].ts < cutoff) {
      break;
    }
    total += entries[i].value;
  }
  return total;
}

/** Remove entries older than the cutoff timestamp. */
function cleanupEntries(entries: WindowEntry[], cutoff: number): WindowEntry[] {
  let firstValid = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].ts >= cutoff) {
      firstValid = i;
      break;
    }
    if (i === entries.length - 1) {
      // All entries are expired
      return [];
    }
  }
  if (firstValid === 0) {
    return entries;
  }
  return entries.slice(firstValid);
}

/**
 * Find the earliest entry timestamp in the window. Returns 0 if the window
 * is empty. Used to compute retryAfterMs for rejected requests.
 */
function oldestTimestamp(entries: WindowEntry[], cutoff: number): number {
  for (const entry of entries) {
    if (entry.ts >= cutoff) {
      return entry.ts;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a per-provider rate limiter.
 *
 * @param config - Rate limiter configuration. When undefined or empty,
 *   all providers pass through with zero overhead.
 */
export function createProviderRateLimiter(config?: RateLimiterConfig): ProviderRateLimiter {
  const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
  const cleanupIntervalMs = Math.max(1, Math.floor(windowMs / 4));

  // Per-provider state. Only created for providers with configured limits.
  const states = new Map<string, ProviderRateLimitState>();

  // Cache resolved configs to avoid repeated lookups.
  const configCache = new Map<string, ResolvedProviderConfig | null>();

  /** Normalize provider ID to lowercase. */
  function normalize(providerId: string): string {
    return providerId.toLowerCase();
  }

  /** Resolve and cache the config for a provider. */
  function getResolvedConfig(normalized: string): ResolvedProviderConfig | null {
    const cached = configCache.get(normalized);
    if (cached !== undefined) {
      return cached;
    }
    const resolved = resolveProviderConfig(normalized, config);
    configCache.set(normalized, resolved);
    return resolved;
  }

  /** Get or lazily create state for a provider. Returns null for unconfigured providers. */
  function getOrCreateState(normalized: string): ProviderRateLimitState | null {
    const existing = states.get(normalized);
    if (existing) {
      return existing;
    }

    const resolved = getResolvedConfig(normalized);
    if (!resolved) {
      return null;
    }

    const state: ProviderRateLimitState = {
      requests: [],
      tokens: [],
      config: resolved,
      retryAfterUntil: 0,
      lastCleanup: Date.now(),
    };
    states.set(normalized, state);
    return state;
  }

  /** Run lazy cleanup on a provider's windows if the interval has elapsed. */
  function maybeCleanup(state: ProviderRateLimitState, now: number): void {
    if (now - state.lastCleanup < cleanupIntervalMs) {
      return;
    }
    state.lastCleanup = now;
    const cutoff = now - windowMs;
    state.requests = cleanupEntries(state.requests, cutoff);
    state.tokens = cleanupEntries(state.tokens, cutoff);
  }

  // -- Public API -----------------------------------------------------------

  function tryAcquire(providerId: string, estimatedTokens?: number): RateLimitCheckResult {
    const normalized = normalize(providerId);
    const state = getOrCreateState(normalized);

    // Zero-config pass-through: no limits configured for this provider.
    if (!state) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const now = Date.now();
    maybeCleanup(state, now);

    // Check Retry-After block from a previous 429 response.
    if (state.retryAfterUntil > now) {
      return {
        allowed: false,
        retryAfterMs: state.retryAfterUntil - now,
        rejectedBy: "retry-after",
      };
    }

    const cutoff = now - windowMs;

    // Check RPM limit.
    if (state.config.rpm > 0) {
      const currentRpm = sumInWindow(state.requests, cutoff);
      if (currentRpm >= state.config.rpm) {
        const oldest = oldestTimestamp(state.requests, cutoff);
        const retryAfterMs = oldest > 0 ? oldest + windowMs - now : 0;
        return {
          allowed: false,
          retryAfterMs: Math.max(0, retryAfterMs),
          rejectedBy: "rpm",
        };
      }
    }

    // Check TPM limit.
    if (state.config.tpm > 0) {
      const currentTpm = sumInWindow(state.tokens, cutoff);
      const estimate = estimatedTokens ?? 0;
      if (currentTpm + estimate > state.config.tpm) {
        const oldest = oldestTimestamp(state.tokens, cutoff);
        const retryAfterMs = oldest > 0 ? oldest + windowMs - now : 0;
        return {
          allowed: false,
          retryAfterMs: Math.max(0, retryAfterMs),
          rejectedBy: "tpm",
        };
      }
    }

    return { allowed: true, retryAfterMs: 0 };
  }

  function recordUsage(providerId: string, tokens: number): void {
    const normalized = normalize(providerId);
    const state = getOrCreateState(normalized);
    if (!state) {
      return;
    }

    const now = Date.now();
    maybeCleanup(state, now);

    // Append request entry (RPM tracking: 1 request per call).
    state.requests.push({ ts: now, value: 1 });

    // Append token entry (TPM tracking).
    if (tokens > 0) {
      state.tokens.push({ ts: now, value: tokens });
    }
  }

  function recordRateLimitHit(providerId: string, retryAfterMs?: number): void {
    const normalized = normalize(providerId);

    // Force state creation even for unconfigured providers when a 429 is received.
    let state = states.get(normalized);
    if (!state) {
      const resolved = getResolvedConfig(normalized) ?? { rpm: 0, tpm: 0 };
      state = {
        requests: [],
        tokens: [],
        config: resolved,
        retryAfterUntil: 0,
        lastCleanup: Date.now(),
      };
      states.set(normalized, state);
    }

    const now = Date.now();
    const waitMs = retryAfterMs !== undefined && retryAfterMs > 0 ? retryAfterMs : windowMs;
    state.retryAfterUntil = now + waitMs;
  }

  function getUsage(providerId: string): ProviderUsageStats | null {
    const normalized = normalize(providerId);
    const state = states.get(normalized);
    if (!state) {
      // No state exists -- check if config exists to return zero stats.
      const resolved = getResolvedConfig(normalized);
      if (!resolved) {
        return null;
      }
      return {
        currentRpm: 0,
        rpmLimit: resolved.rpm,
        rpmUtilization: 0,
        currentTpm: 0,
        tpmLimit: resolved.tpm,
        tpmUtilization: 0,
        isRetryAfterActive: false,
      };
    }

    const now = Date.now();
    const cutoff = now - windowMs;

    const currentRpm = sumInWindow(state.requests, cutoff);
    const currentTpm = sumInWindow(state.tokens, cutoff);
    const rpmLimit = state.config.rpm;
    const tpmLimit = state.config.tpm;

    return {
      currentRpm,
      rpmLimit,
      rpmUtilization: rpmLimit > 0 ? Math.min(100, (currentRpm / rpmLimit) * 100) : 0,
      currentTpm,
      tpmLimit,
      tpmUtilization: tpmLimit > 0 ? Math.min(100, (currentTpm / tpmLimit) * 100) : 0,
      isRetryAfterActive: state.retryAfterUntil > now,
    };
  }

  function reset(): void {
    states.clear();
    configCache.clear();
  }

  return { tryAcquire, recordUsage, recordRateLimitHit, getUsage, reset };
}
