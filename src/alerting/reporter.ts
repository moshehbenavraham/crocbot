/**
 * Error reporter - main API for error reporting and alerting.
 *
 * Orchestrates error classification, aggregation, and notification
 * through configured channels (webhook, Telegram).
 */

import { randomUUID } from "node:crypto";

import type { AlertingConfig } from "../config/types.alerting.js";
import { loadConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { incrementErrorsWithSeverity } from "../metrics/gateway.js";
import { getAggregator, resetAggregator } from "./aggregator.js";
import type { AlertPayload, Notifier } from "./notifier.js";
import { createTelegramNotifier } from "./notifier-telegram.js";
import { createWebhookNotifier } from "./notifier-webhook.js";
import { type AlertSeverity, classifySeverity } from "./severity.js";

const log = createSubsystemLogger("alerting/reporter");

/** Options for reporting an error. */
export interface ReportOptions {
  /** Override automatic severity classification. */
  severity?: AlertSeverity;
  /** Context for grouping/deduplication (e.g., channel name). */
  context?: string;
  /** Additional metadata to include in alert. */
  metadata?: Record<string, unknown>;
}

/** Result of reporting an error. */
export interface ReportResult {
  /** Whether an alert was triggered. */
  alerted: boolean;
  /** Reason if not alerted. */
  reason?: "disabled" | "deduplicated" | "rate_limited" | "no_notifiers";
  /** Classified severity. */
  severity: AlertSeverity;
  /** Alert ID if alerted. */
  alertId?: string;
}

/** Reporter state for singleton management. */
interface ReporterState {
  initialized: boolean;
  enabled: boolean;
  notifiers: Notifier[];
  inProgress: boolean; // Re-entry guard
}

const state: ReporterState = {
  initialized: false,
  enabled: true,
  notifiers: [],
  inProgress: false,
};

/**
 * Initialize the error reporter with configuration.
 *
 * Call this during gateway startup to configure notifiers.
 */
export function initializeReporter(config?: AlertingConfig): void {
  const alertingConfig = config ?? loadConfig().gateway?.alerting;

  state.enabled = alertingConfig?.enabled !== false;
  state.notifiers = [];

  if (!state.enabled) {
    log.info("Alerting disabled by configuration");
    state.initialized = true;
    return;
  }

  // Initialize aggregator with config
  getAggregator(alertingConfig);

  // Create configured notifiers
  const webhookNotifier = createWebhookNotifier(alertingConfig?.webhook);
  if (webhookNotifier) {
    state.notifiers.push(webhookNotifier);
    log.info("Webhook notifier configured", { url: alertingConfig?.webhook?.url });
  }

  const telegramNotifier = createTelegramNotifier(alertingConfig?.telegram);
  if (telegramNotifier) {
    state.notifiers.push(telegramNotifier);
    log.info("Telegram notifier configured", { chatId: alertingConfig?.telegram?.chatId });
  }

  if (state.notifiers.length === 0) {
    log.info("No alert notifiers configured");
  }

  state.initialized = true;
  log.debug("Error reporter initialized", { notifierCount: state.notifiers.length });
}

/**
 * Report an error for potential alerting.
 *
 * This is the main entry point for error reporting. It:
 * 1. Classifies the error severity
 * 2. Checks aggregation (deduplication, rate limiting)
 * 3. Dispatches to configured notifiers if appropriate
 * 4. Updates metrics
 *
 * @param error - The error to report (Error, string, or unknown)
 * @param options - Optional configuration for this report
 * @returns Result indicating what action was taken
 */
export async function reportError(
  error: unknown,
  options: ReportOptions = {},
): Promise<ReportResult> {
  // Extract error message
  const message = extractErrorMessage(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Classify severity (use override if provided)
  const severity = options.severity ?? classifySeverity(error);

  // Update metrics regardless of alerting outcome
  incrementErrorsWithSeverity(options.context ?? "unknown", severity);

  // Check if reporter is initialized
  if (!state.initialized) {
    initializeReporter();
  }

  // Check if alerting is enabled
  if (!state.enabled) {
    return { alerted: false, reason: "disabled", severity };
  }

  // Re-entry guard to prevent circular dependency with logger
  if (state.inProgress) {
    log.debug("Skipping nested error report to prevent recursion");
    return { alerted: false, reason: "disabled", severity };
  }

  // Check aggregation (deduplication, rate limiting)
  const aggregator = getAggregator();
  const aggregationResult = aggregator.check(message, severity, options.context);

  if (!aggregationResult.shouldAlert) {
    log.debug(`Error aggregated: ${aggregationResult.reason}`, {
      dedupeKey: aggregationResult.dedupeKey,
      count: aggregationResult.count,
    });
    return {
      alerted: false,
      reason: aggregationResult.reason,
      severity,
    };
  }

  // Check if we have any notifiers
  if (state.notifiers.length === 0) {
    return { alerted: false, reason: "no_notifiers", severity };
  }

  // Build alert payload
  const alertId = randomUUID();
  const payload: AlertPayload = {
    id: alertId,
    message,
    severity,
    timestamp: new Date().toISOString(),
    context: options.context,
    count: aggregationResult.count,
    stack,
    metadata: options.metadata,
  };

  // Dispatch to all notifiers (set re-entry guard)
  state.inProgress = true;
  try {
    const results = await Promise.allSettled(
      state.notifiers.map((notifier) =>
        notifier.notify(payload).catch((err) => {
          log.warn(`Notifier ${notifier.name} threw: ${String(err)}`);
          return { success: false, error: String(err) };
        }),
      ),
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        log.warn(`Notifier ${state.notifiers[index].name} rejected: ${result.reason}`);
      } else if (!result.value.success) {
        log.debug(`Notifier ${state.notifiers[index].name} failed: ${result.value.error}`);
      }
    });

    log.info(`Alert dispatched: ${alertId}`, { severity, context: options.context });
    return { alerted: true, severity, alertId };
  } finally {
    state.inProgress = false;
  }
}

/**
 * Convenience function to report and log an error.
 *
 * Combines logging and alerting in one call.
 */
export async function reportAndLogError(
  error: unknown,
  options: ReportOptions = {},
): Promise<ReportResult> {
  const message = extractErrorMessage(error);
  log.error(message, options.metadata);
  return reportError(error, options);
}

/**
 * Reset the reporter state. Used for testing.
 */
export function resetReporter(): void {
  state.initialized = false;
  state.enabled = true;
  state.notifiers = [];
  state.inProgress = false;
  resetAggregator();
}

/**
 * Check if the reporter is initialized.
 */
export function isReporterInitialized(): boolean {
  return state.initialized;
}

/**
 * Get the number of configured notifiers.
 */
export function getNotifierCount(): number {
  return state.notifiers.length;
}

/**
 * Extract error message from various error types.
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
