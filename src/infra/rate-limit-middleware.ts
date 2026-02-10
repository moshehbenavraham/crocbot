/**
 * Rate limit middleware helpers for LLM call site integration.
 *
 * Provides:
 * - `estimateTokens()` -- rough token count from character length
 * - `withRateLimitCheck()` -- wrapper for fetch-based call sites
 * - Structured log helpers for throttle/reject/retry/usage events
 */

import type { ProviderRateLimiter, RateLimiterConfig } from "./provider-rate-limiter-config.js";
import { createProviderRateLimiter } from "./provider-rate-limiter.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("infra/rate-limiter");

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

const DEFAULT_TOKEN_ESTIMATION_DIVISOR = 4;

/**
 * Estimate token count from text length using chars / divisor heuristic.
 * Returns 0 for empty/nullish input. The divisor defaults to 4 (1 token ~= 4 chars).
 */
export function estimateTokens(text: string | undefined | null, divisor?: number): number {
  if (!text) {
    return 0;
  }
  const d = divisor ?? DEFAULT_TOKEN_ESTIMATION_DIVISOR;
  return Math.max(1, Math.ceil(text.length / d));
}

// ---------------------------------------------------------------------------
// Structured log helpers
// ---------------------------------------------------------------------------

export function logThrottle(params: {
  provider: string;
  rejectedBy: string;
  retryAfterMs: number;
  context?: string;
  role?: string;
}): void {
  log.info(
    `rate-limit throttle: provider=${params.provider} rejectedBy=${params.rejectedBy} retryAfterMs=${params.retryAfterMs}${params.role ? ` role=${params.role}` : ""}${params.context ? ` context=${params.context}` : ""}`,
  );
}

export function logReject(params: {
  provider: string;
  rejectedBy: string;
  retryAfterMs: number;
  context?: string;
  role?: string;
}): void {
  log.warn(
    `rate-limit reject: provider=${params.provider} rejectedBy=${params.rejectedBy} retryAfterMs=${params.retryAfterMs}${params.role ? ` role=${params.role}` : ""}${params.context ? ` context=${params.context}` : ""}`,
  );
}

export function logRetry(params: {
  provider: string;
  retryAfterMs: number;
  context?: string;
  role?: string;
}): void {
  log.info(
    `rate-limit retry-after recorded: provider=${params.provider} retryAfterMs=${params.retryAfterMs}${params.role ? ` role=${params.role}` : ""}${params.context ? ` context=${params.context}` : ""}`,
  );
}

export function logUsageRecorded(params: {
  provider: string;
  tokens: number;
  context?: string;
  role?: string;
}): void {
  log.debug(
    `rate-limit usage recorded: provider=${params.provider} tokens=${params.tokens}${params.role ? ` role=${params.role}` : ""}${params.context ? ` context=${params.context}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// withRateLimitCheck wrapper for fetch-based call sites
// ---------------------------------------------------------------------------

/**
 * Wraps a fetch-based call site with rate limiter pre-flight check and
 * post-flight usage recording.
 *
 * When `rateLimiter` is undefined (no config), the `fn` runs directly
 * with zero overhead. When the rate limiter rejects the request, an
 * Error is thrown with a descriptive message.
 *
 * @param params.rateLimiter - Optional rate limiter instance
 * @param params.provider - LLM provider identifier
 * @param params.estimatedTokens - Estimated tokens for pre-flight check
 * @param params.actualTokens - Function to extract actual tokens from the result
 * @param params.context - Optional context label for log messages (e.g. "embeddings-openai")
 * @param params.fn - The actual fetch function to execute
 */
export async function withRateLimitCheck<T>(params: {
  rateLimiter?: ProviderRateLimiter;
  provider: string;
  estimatedTokens?: number;
  actualTokens?: (result: T) => number | undefined;
  context?: string;
  role?: string;
  fn: () => Promise<T>;
}): Promise<T> {
  if (!params.rateLimiter) {
    return params.fn();
  }

  const check = params.rateLimiter.tryAcquire(params.provider, params.estimatedTokens);

  if (!check.allowed) {
    logReject({
      provider: params.provider,
      rejectedBy: check.rejectedBy ?? "unknown",
      retryAfterMs: check.retryAfterMs,
      context: params.context,
      role: params.role,
    });
    throw new Error(
      `Rate limit exceeded for provider ${params.provider} (${check.rejectedBy ?? "unknown"}). Retry after ${check.retryAfterMs}ms.`,
    );
  }

  const result = await params.fn();

  const tokens = params.actualTokens?.(result);
  if (tokens !== undefined && tokens > 0) {
    params.rateLimiter.recordUsage(params.provider, tokens);
    logUsageRecorded({
      provider: params.provider,
      tokens,
      context: params.context,
      role: params.role,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Factory helper for config-driven instantiation
// ---------------------------------------------------------------------------

/**
 * Create a rate limiter from crocbot config, or return undefined when
 * no `rateLimits` section is present (zero-config pass-through).
 */
export function createRateLimiterFromConfig(
  rateLimitsConfig: RateLimiterConfig | undefined,
): ProviderRateLimiter | undefined {
  if (!rateLimitsConfig) {
    return undefined;
  }

  const limiter = createProviderRateLimiter(rateLimitsConfig);
  log.info("rate limiter initialized from config");
  return limiter;
}
