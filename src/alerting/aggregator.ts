/**
 * Error aggregation with deduplication and rate limiting.
 *
 * Prevents alert storms by:
 * - Deduplicating identical errors within a configurable window
 * - Rate limiting alerts per severity level
 */

import { createHash } from "node:crypto";

import type { AlertSeverity, AlertingConfig } from "../config/types.alerting.js";

/** Default configuration values. */
const DEFAULTS = {
  dedupeWindowMs: 5 * 60 * 1000, // 5 minutes
  rateLimitCritical: 5,
  rateLimitWarning: 10,
  rateLimitWindowMs: 5 * 60 * 1000, // 5 minutes
};

/** Entry tracking a deduplicated error. */
interface DedupeEntry {
  /** First occurrence timestamp. */
  firstSeen: number;
  /** Most recent occurrence timestamp. */
  lastSeen: number;
  /** Number of occurrences. */
  count: number;
  /** Severity of the error. */
  severity: AlertSeverity;
}

/** Entry tracking rate limit state for a severity level. */
interface RateLimitEntry {
  /** Window start timestamp. */
  windowStart: number;
  /** Number of alerts sent in this window. */
  count: number;
}

/** Result of checking if an error should trigger an alert. */
export interface AggregationResult {
  /** Whether an alert should be sent. */
  shouldAlert: boolean;
  /** If not alerting, the reason why. */
  reason?: "deduplicated" | "rate_limited";
  /** Number of occurrences of this error (for alert payload). */
  count: number;
  /** Generated deduplication key. */
  dedupeKey: string;
}

/**
 * Error aggregator with deduplication and rate limiting.
 *
 * Uses singleton pattern internally but exposes reset for testing.
 */
export class ErrorAggregator {
  private dedupeMap = new Map<string, DedupeEntry>();
  private rateLimitMap = new Map<AlertSeverity, RateLimitEntry>();
  private config: Required<
    Pick<
      AlertingConfig,
      "dedupeWindowMs" | "rateLimitCritical" | "rateLimitWarning" | "rateLimitWindowMs"
    >
  >;

  constructor(config?: Partial<AlertingConfig>) {
    this.config = {
      dedupeWindowMs: config?.dedupeWindowMs ?? DEFAULTS.dedupeWindowMs,
      rateLimitCritical: config?.rateLimitCritical ?? DEFAULTS.rateLimitCritical,
      rateLimitWarning: config?.rateLimitWarning ?? DEFAULTS.rateLimitWarning,
      rateLimitWindowMs: config?.rateLimitWindowMs ?? DEFAULTS.rateLimitWindowMs,
    };
  }

  /**
   * Check if an error should trigger an alert.
   *
   * @param message - Error message
   * @param severity - Classified severity
   * @param context - Optional context for deduplication (e.g., channel name)
   * @returns Aggregation result indicating whether to alert
   */
  check(message: string, severity: AlertSeverity, context?: string): AggregationResult {
    const now = Date.now();
    const dedupeKey = this.generateDedupeKey(message, context);

    // Clean up expired entries periodically
    this.cleanupExpired(now);

    // Check deduplication
    const existing = this.dedupeMap.get(dedupeKey);
    if (existing) {
      const windowExpired = now - existing.firstSeen > this.config.dedupeWindowMs;
      if (!windowExpired) {
        // Update count but don't alert
        existing.lastSeen = now;
        existing.count += 1;
        return {
          shouldAlert: false,
          reason: "deduplicated",
          count: existing.count,
          dedupeKey,
        };
      }
      // Window expired, remove old entry and continue as new
      this.dedupeMap.delete(dedupeKey);
    }

    // Check rate limiting
    if (!this.checkRateLimit(severity, now)) {
      // Still record the error even if rate limited
      this.dedupeMap.set(dedupeKey, {
        firstSeen: now,
        lastSeen: now,
        count: 1,
        severity,
      });
      return {
        shouldAlert: false,
        reason: "rate_limited",
        count: 1,
        dedupeKey,
      };
    }

    // Record new error and allow alert
    this.dedupeMap.set(dedupeKey, {
      firstSeen: now,
      lastSeen: now,
      count: 1,
      severity,
    });

    // Increment rate limit counter
    this.incrementRateLimit(severity, now);

    return {
      shouldAlert: true,
      count: 1,
      dedupeKey,
    };
  }

  /**
   * Update configuration at runtime.
   */
  updateConfig(config: Partial<AlertingConfig>): void {
    if (config.dedupeWindowMs !== undefined) {
      this.config.dedupeWindowMs = config.dedupeWindowMs;
    }
    if (config.rateLimitCritical !== undefined) {
      this.config.rateLimitCritical = config.rateLimitCritical;
    }
    if (config.rateLimitWarning !== undefined) {
      this.config.rateLimitWarning = config.rateLimitWarning;
    }
    if (config.rateLimitWindowMs !== undefined) {
      this.config.rateLimitWindowMs = config.rateLimitWindowMs;
    }
  }

  /**
   * Reset all aggregation state. Used for testing.
   */
  reset(): void {
    this.dedupeMap.clear();
    this.rateLimitMap.clear();
  }

  /**
   * Get current aggregation stats (for monitoring/debugging).
   */
  getStats(): { dedupeEntries: number; rateLimitEntries: number } {
    return {
      dedupeEntries: this.dedupeMap.size,
      rateLimitEntries: this.rateLimitMap.size,
    };
  }

  /**
   * Generate a deduplication key from message and context.
   */
  private generateDedupeKey(message: string, context?: string): string {
    const input = context ? `${context}:${message}` : message;
    return createHash("sha256").update(input).digest("hex").slice(0, 16);
  }

  /**
   * Check if rate limit allows another alert for this severity.
   */
  private checkRateLimit(severity: AlertSeverity, now: number): boolean {
    // Info severity is not rate limited
    if (severity === "info") {
      return true;
    }

    const entry = this.rateLimitMap.get(severity);
    if (!entry) {
      return true;
    }

    const windowExpired = now - entry.windowStart > this.config.rateLimitWindowMs;
    if (windowExpired) {
      this.rateLimitMap.delete(severity);
      return true;
    }

    const limit =
      severity === "critical" ? this.config.rateLimitCritical : this.config.rateLimitWarning;
    return entry.count < limit;
  }

  /**
   * Increment the rate limit counter for a severity level.
   */
  private incrementRateLimit(severity: AlertSeverity, now: number): void {
    // Info severity is not rate limited
    if (severity === "info") {
      return;
    }

    const entry = this.rateLimitMap.get(severity);
    if (entry) {
      const windowExpired = now - entry.windowStart > this.config.rateLimitWindowMs;
      if (windowExpired) {
        this.rateLimitMap.set(severity, { windowStart: now, count: 1 });
      } else {
        entry.count += 1;
      }
    } else {
      this.rateLimitMap.set(severity, { windowStart: now, count: 1 });
    }
  }

  /**
   * Clean up expired deduplication entries.
   */
  private cleanupExpired(now: number): void {
    for (const [key, entry] of this.dedupeMap) {
      if (now - entry.firstSeen > this.config.dedupeWindowMs) {
        this.dedupeMap.delete(key);
      }
    }
  }
}

// Singleton instance for global use
let globalAggregator: ErrorAggregator | null = null;

/**
 * Get the global error aggregator instance.
 */
export function getAggregator(config?: Partial<AlertingConfig>): ErrorAggregator {
  if (!globalAggregator) {
    globalAggregator = new ErrorAggregator(config);
  } else if (config) {
    globalAggregator.updateConfig(config);
  }
  return globalAggregator;
}

/**
 * Reset the global aggregator. Used for testing.
 */
export function resetAggregator(): void {
  if (globalAggregator) {
    globalAggregator.reset();
  }
  globalAggregator = null;
}
