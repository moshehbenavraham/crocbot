/**
 * Alerting configuration types for error reporting and notifications.
 */

/** Severity levels for error classification. */
export type AlertSeverity = "critical" | "warning" | "info";

/** Webhook notification channel configuration. */
export type AlertingWebhookConfig = {
  /** Webhook URL to POST alerts to. */
  url: string;
  /** Optional headers to include in webhook requests (e.g., auth). */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 5000). */
  timeoutMs?: number;
};

/** Telegram self-notification channel configuration. */
export type AlertingTelegramConfig = {
  /** Chat ID to send alert notifications to. */
  chatId: string;
  /** Telegram account ID (default: "default"). */
  accountId?: string;
  /** Minimum severity to trigger Telegram notification (default: "critical"). */
  minSeverity?: AlertSeverity;
};

/** Main alerting configuration. */
export type AlertingConfig = {
  /** Master switch to enable/disable alerting (default: true). */
  enabled?: boolean;

  /** Deduplication window in milliseconds (default: 300000 = 5min). */
  dedupeWindowMs?: number;

  /** Max critical alerts per rate limit window (default: 5). */
  rateLimitCritical?: number;
  /** Max warning alerts per rate limit window (default: 10). */
  rateLimitWarning?: number;
  /** Rate limit window in milliseconds (default: 300000 = 5min). */
  rateLimitWindowMs?: number;

  /** Webhook notification configuration. */
  webhook?: AlertingWebhookConfig;

  /** Telegram self-notification configuration. */
  telegram?: AlertingTelegramConfig;
};
