/**
 * Configuration types and resolution logic for the per-provider rate limiter.
 *
 * The rate limiter enforces per-provider RPM (requests per minute) and TPM
 * (tokens per minute) limits using a sliding window log algorithm.
 */

// ---------------------------------------------------------------------------
// Window data structures
// ---------------------------------------------------------------------------

/** A single timestamped entry in the sliding window log. */
export interface WindowEntry {
  /** Unix timestamp in milliseconds when this entry was recorded. */
  ts: number;
  /** The value associated with this entry (1 for requests, token count for TPM). */
  value: number;
}

// ---------------------------------------------------------------------------
// Configuration interfaces
// ---------------------------------------------------------------------------

/** Rate limits for a single LLM provider. */
export interface ProviderRateLimitConfig {
  /** Requests per minute. 0 or undefined means unlimited for this dimension. */
  rpm?: number;
  /** Tokens per minute. 0 or undefined means unlimited for this dimension. */
  tpm?: number;
}

/** Top-level rate limiter configuration. */
export interface RateLimiterConfig {
  /** Default limits applied to any provider without a specific override. */
  defaults?: ProviderRateLimitConfig;
  /** Provider-specific limit overrides. Keys are provider IDs (case-insensitive). */
  providers?: Record<string, ProviderRateLimitConfig>;
  /** Sliding window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
  /** Character-to-token estimation divisor. Default: 4 (chars / 4 = estimated tokens). */
  tokenEstimationDivisor?: number;
}

/** Result of a pre-flight capacity check via `tryAcquire()`. */
export interface RateLimitCheckResult {
  /** Whether the request is allowed to proceed. */
  allowed: boolean;
  /**
   * When `allowed` is false, the estimated milliseconds until capacity is
   * available. When `allowed` is true, this is 0.
   */
  retryAfterMs: number;
  /** When `allowed` is false, which dimension caused rejection: "rpm" | "tpm" | "retry-after". */
  rejectedBy?: "rpm" | "tpm" | "retry-after";
}

// ---------------------------------------------------------------------------
// Internal state types
// ---------------------------------------------------------------------------

/** Per-provider internal tracking state. */
export interface ProviderRateLimitState {
  /** Sliding window log for request counts (RPM). */
  requests: WindowEntry[];
  /** Sliding window log for token counts (TPM). */
  tokens: WindowEntry[];
  /** Resolved configuration for this provider. */
  config: ResolvedProviderConfig;
  /** Timestamp (ms) until which the provider is blocked due to a 429 Retry-After. */
  retryAfterUntil: number;
  /** Timestamp of last cleanup sweep for this provider. */
  lastCleanup: number;
}

/** Resolved (non-optional) limits for a provider. 0 means unlimited. */
export interface ResolvedProviderConfig {
  rpm: number;
  tpm: number;
}

// ---------------------------------------------------------------------------
// Observability types
// ---------------------------------------------------------------------------

/** Usage statistics returned by `getUsage()`. */
export interface ProviderUsageStats {
  /** Current requests in the sliding window. */
  currentRpm: number;
  /** Configured RPM limit (0 = unlimited). */
  rpmLimit: number;
  /** RPM utilization percentage (0-100). 0 when unlimited. */
  rpmUtilization: number;
  /** Current tokens in the sliding window. */
  currentTpm: number;
  /** Configured TPM limit (0 = unlimited). */
  tpmLimit: number;
  /** TPM utilization percentage (0-100). 0 when unlimited. */
  tpmUtilization: number;
  /** Whether the provider is currently blocked by a Retry-After. */
  isRetryAfterActive: boolean;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Public API for the per-provider rate limiter. */
export interface ProviderRateLimiter {
  /**
   * Pre-flight capacity check. Returns whether the request can proceed
   * given current RPM/TPM usage within the sliding window.
   *
   * @param providerId - LLM provider identifier (case-insensitive).
   * @param estimatedTokens - Estimated token count for the request (optional).
   */
  tryAcquire(providerId: string, estimatedTokens?: number): RateLimitCheckResult;

  /**
   * Post-flight usage recording. Appends actual token usage to the sliding
   * window after a successful LLM call.
   *
   * @param providerId - LLM provider identifier (case-insensitive).
   * @param tokens - Actual tokens consumed by the request.
   */
  recordUsage(providerId: string, tokens: number): void;

  /**
   * Record a 429 rate limit response from the provider. Blocks subsequent
   * `tryAcquire()` calls until the retry-after period expires.
   *
   * @param providerId - LLM provider identifier (case-insensitive).
   * @param retryAfterMs - Optional milliseconds to wait before retrying.
   *   Defaults to the full window duration if not provided.
   */
  recordRateLimitHit(providerId: string, retryAfterMs?: number): void;

  /**
   * Get current usage statistics for a provider.
   *
   * @param providerId - LLM provider identifier (case-insensitive).
   * @returns Usage stats, or null if no limits are configured and no state exists.
   */
  getUsage(providerId: string): ProviderUsageStats | null;

  /** Reset all internal state. Useful for testing. */
  reset(): void;
}

// ---------------------------------------------------------------------------
// Configuration resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective rate limit config for a provider.
 *
 * Resolution cascade: provider-specific > defaults > unlimited (0/0).
 * A value of 0 or undefined means unlimited for that dimension.
 */
export function resolveProviderConfig(
  providerId: string,
  config?: RateLimiterConfig,
): ResolvedProviderConfig | null {
  if (!config) {
    return null;
  }

  const normalized = providerId.toLowerCase();
  const providerOverride = config.providers?.[normalized];

  // Check all possible provider key casings in the config
  let matched: ProviderRateLimitConfig | undefined = providerOverride;
  if (!matched && config.providers) {
    for (const [key, value] of Object.entries(config.providers)) {
      if (key.toLowerCase() === normalized) {
        matched = value;
        break;
      }
    }
  }

  const hasProviderConfig = matched !== undefined;
  const hasDefaults = config.defaults !== undefined;

  if (!hasProviderConfig && !hasDefaults) {
    return null;
  }

  const rpm = matched?.rpm ?? config.defaults?.rpm ?? 0;
  const tpm = matched?.tpm ?? config.defaults?.tpm ?? 0;

  // If both resolve to 0 (unlimited), no enforcement needed
  if (rpm <= 0 && tpm <= 0) {
    return null;
  }

  return {
    rpm: Math.max(0, rpm),
    tpm: Math.max(0, tpm),
  };
}
