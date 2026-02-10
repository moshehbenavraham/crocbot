/**
 * Singleton rate limiter instance for the gateway process.
 *
 * Initialized once at gateway startup via `initGlobalRateLimiter()`.
 * Call `getGlobalRateLimiter()` from any call site that needs access.
 * Returns undefined when no `rateLimits` config is set (zero-overhead pass-through).
 */

import type { ProviderRateLimiter, RateLimiterConfig } from "./provider-rate-limiter-config.js";
import { createProviderRateLimiter } from "./provider-rate-limiter.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("infra/rate-limiter");

let instance: ProviderRateLimiter | undefined;

/**
 * Initialize the global rate limiter from config.
 * Should be called once at gateway startup.
 */
export function initGlobalRateLimiter(config: RateLimiterConfig | undefined): void {
  if (!config) {
    instance = undefined;
    return;
  }
  instance = createProviderRateLimiter(config);
  log.info("global rate limiter initialized from config");
}

/** Get the global rate limiter instance. Returns undefined when not configured. */
export function getGlobalRateLimiter(): ProviderRateLimiter | undefined {
  return instance;
}

/** Reset the global rate limiter (for testing). */
export function resetGlobalRateLimiter(): void {
  instance = undefined;
}
