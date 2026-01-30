/**
 * Notifier interface for pluggable alert notification channels.
 *
 * Implements the Strategy pattern to support multiple notification
 * backends (webhook, Telegram, etc.) with a common interface.
 */

import type { AlertSeverity } from "../config/types.alerting.js";

/** Alert payload passed to notifiers. */
export interface AlertPayload {
  /** Unique identifier for this alert instance. */
  id: string;
  /** Error message or description. */
  message: string;
  /** Classified severity level. */
  severity: AlertSeverity;
  /** ISO timestamp when the error occurred. */
  timestamp: string;
  /** Optional context (channel, subsystem, etc.). */
  context?: string;
  /** Number of occurrences within deduplication window. */
  count: number;
  /** Optional stack trace. */
  stack?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

/** Result of a notification attempt. */
export interface NotifyResult {
  /** Whether the notification was successfully sent. */
  success: boolean;
  /** Error message if notification failed. */
  error?: string;
}

/**
 * Notifier interface for alert delivery channels.
 *
 * Implementations should handle their own error recovery and
 * never throw exceptions - failures should be returned via NotifyResult.
 */
export interface Notifier {
  /** Unique name for this notifier (e.g., "webhook", "telegram"). */
  readonly name: string;

  /**
   * Send an alert notification.
   *
   * @param payload - The alert payload to send
   * @returns Result indicating success or failure
   */
  notify(payload: AlertPayload): Promise<NotifyResult>;
}
