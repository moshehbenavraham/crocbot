/**
 * Alerting module - error reporting and notification system.
 *
 * Provides error classification, aggregation (deduplication/rate limiting),
 * and notification dispatch through configurable channels.
 *
 * @example
 * ```ts
 * import { initializeReporter, reportError } from "./alerting/index.js";
 *
 * // Initialize during startup
 * initializeReporter();
 *
 * // Report errors
 * await reportError(new Error("Something went wrong"), {
 *   context: "telegram",
 * });
 * ```
 */

// Re-export severity classification
export {
  type AlertSeverity,
  classifySeverity,
  compareSeverity,
  meetsMinSeverity,
  SEVERITY_LEVELS,
} from "./severity.js";

// Re-export notifier interface
export type { AlertPayload, Notifier, NotifyResult } from "./notifier.js";

// Re-export aggregator
export {
  ErrorAggregator,
  getAggregator,
  resetAggregator,
  type AggregationResult,
} from "./aggregator.js";

// Re-export reporter (main API)
export {
  initializeReporter,
  reportError,
  reportAndLogError,
  resetReporter,
  isReporterInitialized,
  getNotifierCount,
  type ReportOptions,
  type ReportResult,
} from "./reporter.js";

// Re-export notifier factories for custom usage
export { createWebhookNotifier, WebhookNotifier } from "./notifier-webhook.js";
export { createTelegramNotifier, TelegramNotifier } from "./notifier-telegram.js";
