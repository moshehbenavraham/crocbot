/**
 * Error severity classification for alerting.
 *
 * Provides severity levels and classification logic to determine
 * alert urgency based on error characteristics.
 */

import type { AlertSeverity } from "../config/types.alerting.js";

export type { AlertSeverity };

/** Severity level numeric values for comparison (lower = more severe). */
export const SEVERITY_LEVELS: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Keywords that indicate critical severity. */
const CRITICAL_KEYWORDS = [
  "fatal",
  "crash",
  "unhandled",
  "uncaught",
  "panic",
  "oom",
  "out of memory",
  "econnrefused",
  "connection refused",
  "auth failed",
  "authentication failed",
  "token invalid",
  "token expired",
  "database connection",
  "database error",
];

/** Keywords that indicate warning severity. */
const WARNING_KEYWORDS = [
  "timeout",
  "timed out",
  "retry",
  "retrying",
  "rate limit",
  "rate-limit",
  "ratelimit",
  "slow",
  "degraded",
  "failed to",
  "could not",
  "unable to",
  "network error",
  "connection reset",
];

/**
 * Classify error severity based on error content.
 *
 * @param error - The error to classify (Error object, string, or unknown)
 * @returns The determined severity level
 */
export function classifySeverity(error: unknown): AlertSeverity {
  const message = extractErrorMessage(error).toLowerCase();

  for (const keyword of CRITICAL_KEYWORDS) {
    if (message.includes(keyword)) {
      return "critical";
    }
  }

  for (const keyword of WARNING_KEYWORDS) {
    if (message.includes(keyword)) {
      return "warning";
    }
  }

  return "info";
}

/**
 * Compare two severity levels.
 *
 * @returns Negative if a is more severe, positive if b is more severe, 0 if equal
 */
export function compareSeverity(a: AlertSeverity, b: AlertSeverity): number {
  return SEVERITY_LEVELS[a] - SEVERITY_LEVELS[b];
}

/**
 * Check if a severity level meets or exceeds a minimum threshold.
 *
 * @param severity - The severity to check
 * @param minSeverity - The minimum required severity
 * @returns True if severity is at least as severe as minSeverity
 */
export function meetsMinSeverity(severity: AlertSeverity, minSeverity: AlertSeverity): boolean {
  return SEVERITY_LEVELS[severity] <= SEVERITY_LEVELS[minSeverity];
}

/**
 * Extract a message string from various error types.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") {
      return obj.message;
    }
  }
  return String(error);
}
