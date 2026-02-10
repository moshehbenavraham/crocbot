/**
 * Key pool adapter: health-aware round-robin key selection with rate limiter
 * integration.
 *
 * Composes the per-provider sliding window rate limiter (Session 02) with the
 * existing auth profile system to provide a single `selectKey()` entry point
 * that returns the best available API key for a provider.
 *
 * This module does NOT modify the auth profile system or the rate limiter --
 * it reads from both and delegates feedback back through them.
 *
 * Created via `createKeyPool(entries, config)`.
 */

import type { ProviderRateLimiter } from "./provider-rate-limiter-config.js";
import type { SecretsRegistry } from "./secrets/registry.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single API key entry in the pool. */
export interface KeyPoolEntry {
  /** Auth profile identifier (matches AuthProfileStore key). */
  profileId: string;
  /** LLM provider identifier (e.g. "openai", "anthropic"). */
  providerId: string;
  /** The raw API key value. */
  apiKey: string;
}

/** Reason categories for key failure feedback. */
export type KeyFailureReason = "auth" | "rate_limit" | "timeout" | "unknown";

/**
 * Dependency-injected functions from the auth profile system.
 * Provided as plain functions for testability (no direct module imports).
 */
export interface KeyPoolDeps {
  /** Check if a profile is currently in cooldown. */
  isInCooldown: (profileId: string) => boolean;
  /** Get ordered profile IDs for a provider (round-robin aware). */
  resolveOrder: (providerId: string) => string[];
  /** Mark a profile as failed (triggers cooldown). */
  markFailure: (profileId: string, reason: KeyFailureReason) => void;
  /** Mark a profile as successfully used (resets error state). */
  markUsed: (profileId: string) => void;
  /** Per-provider rate limiter instance. */
  rateLimiter: ProviderRateLimiter;
  /** Secrets registry for masking API keys in output. */
  secretsRegistry: SecretsRegistry;
}

/** Public API for the key pool. */
export interface KeyPool {
  /**
   * Select the best available API key for a provider.
   *
   * Returns the first key that is both not in cooldown and passes the rate
   * limiter's capacity check. Returns null if no keys are available.
   *
   * @param providerId - LLM provider identifier (case-insensitive).
   * @param estimatedTokens - Optional estimated tokens for TPM check.
   */
  selectKey(providerId: string, estimatedTokens?: number): KeyPoolEntry | null;

  /**
   * Report successful use of a key. Delegates to the auth profile system
   * to reset error state and update lastUsed.
   *
   * @param profileId - The profile ID that succeeded.
   */
  reportSuccess(profileId: string): void;

  /**
   * Report a key failure. Routes feedback to the appropriate subsystem:
   * - 401/403 (auth): marks profile failure with "auth" reason
   * - 429 (rate_limit): marks profile failure AND records rate limit hit
   * - 5xx (timeout/unknown): marks profile failure with appropriate reason
   *
   * @param profileId - The profile ID that failed.
   * @param reason - Failure category.
   * @param statusCode - Optional HTTP status code from the provider response.
   */
  reportFailure(profileId: string, reason: KeyFailureReason, statusCode?: number): void;

  /** Number of keys registered with SecretsRegistry at pool creation. */
  readonly registeredCount: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a key pool adapter.
 *
 * Registers all API key values with SecretsRegistry at creation time to
 * ensure masking is active before any key is used in a request.
 *
 * @param entries - Array of key pool entries (profileId + providerId + apiKey).
 * @param deps - Dependency-injected functions for auth profile and rate limiter ops.
 */
export function createKeyPool(entries: readonly KeyPoolEntry[], deps: KeyPoolDeps): KeyPool {
  // Index entries by providerId for O(1) provider lookup.
  const byProvider = new Map<string, KeyPoolEntry[]>();
  let registeredCount = 0;

  for (const entry of entries) {
    const normalized = entry.providerId.toLowerCase();
    let bucket = byProvider.get(normalized);
    if (!bucket) {
      bucket = [];
      byProvider.set(normalized, bucket);
    }
    bucket.push(entry);

    // Register API key with SecretsRegistry at creation time (before any use).
    const registered = deps.secretsRegistry.register(`key-pool:${entry.profileId}`, entry.apiKey);
    if (registered) {
      registeredCount += 1;
    }
  }

  // -- selectKey -------------------------------------------------------------

  function selectKey(providerId: string, estimatedTokens?: number): KeyPoolEntry | null {
    const normalized = providerId.toLowerCase();
    const bucket = byProvider.get(normalized);

    // Zero keys for this provider -> null immediately.
    if (!bucket || bucket.length === 0) {
      return null;
    }

    // Check rate limiter first -- if the provider is rate-limited, no key works.
    const rateCheck = deps.rateLimiter.tryAcquire(normalized, estimatedTokens);
    if (!rateCheck.allowed) {
      return null;
    }

    // Get ordered profile IDs from the auth profile system (round-robin aware).
    const orderedIds = deps.resolveOrder(normalized);

    // Build a lookup for fast profileId -> entry resolution.
    const entryByProfile = new Map<string, KeyPoolEntry>();
    for (const entry of bucket) {
      entryByProfile.set(entry.profileId, entry);
    }

    // Find the first key in order that is not in cooldown.
    for (const profileId of orderedIds) {
      const entry = entryByProfile.get(profileId);
      if (!entry) {
        continue;
      }
      if (deps.isInCooldown(profileId)) {
        continue;
      }
      return entry;
    }

    // All keys are in cooldown (or no matching profiles in order list).
    return null;
  }

  // -- reportSuccess ---------------------------------------------------------

  function reportSuccess(profileId: string): void {
    deps.markUsed(profileId);
  }

  // -- reportFailure ---------------------------------------------------------

  function reportFailure(profileId: string, reason: KeyFailureReason, statusCode?: number): void {
    // Always mark the profile as failed in the auth profile system.
    deps.markFailure(profileId, reason);

    // On 429, also inform the rate limiter so it blocks subsequent tryAcquire.
    if (statusCode === 429 || reason === "rate_limit") {
      // Find the provider for this profile to pass to the rate limiter.
      for (const [normalized, bucket] of byProvider) {
        for (const entry of bucket) {
          if (entry.profileId === profileId) {
            deps.rateLimiter.recordRateLimitHit(normalized);
            return;
          }
        }
      }
    }
  }

  return {
    selectKey,
    reportSuccess,
    reportFailure,
    get registeredCount() {
      return registeredCount;
    },
  };
}
