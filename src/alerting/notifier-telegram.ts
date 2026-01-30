/**
 * Telegram notifier for self-notification alerts.
 *
 * Uses the existing sendMessageTelegram function to deliver
 * critical alerts to a configured chat.
 */

import type { AlertingTelegramConfig, AlertSeverity } from "../config/types.alerting.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { sendMessageTelegram } from "../telegram/send.js";
import type { AlertPayload, Notifier, NotifyResult } from "./notifier.js";
import { meetsMinSeverity } from "./severity.js";

const log = createSubsystemLogger("alerting/telegram");

/** Default minimum severity for Telegram notifications. */
const DEFAULT_MIN_SEVERITY: AlertSeverity = "critical";

/**
 * Telegram notifier implementation.
 *
 * Sends alert notifications to a configured Telegram chat.
 */
export class TelegramNotifier implements Notifier {
  readonly name = "telegram";
  private readonly config: AlertingTelegramConfig;
  private readonly minSeverity: AlertSeverity;

  constructor(config: AlertingTelegramConfig) {
    this.config = config;
    this.minSeverity = config.minSeverity ?? DEFAULT_MIN_SEVERITY;
  }

  async notify(payload: AlertPayload): Promise<NotifyResult> {
    const chatId = this.config.chatId;
    if (!chatId) {
      return { success: false, error: "Telegram chat ID not configured" };
    }

    // Check severity threshold
    if (!meetsMinSeverity(payload.severity, this.minSeverity)) {
      log.debug(
        `Skipping Telegram notification: severity ${payload.severity} below threshold ${this.minSeverity}`,
      );
      return { success: true }; // Not an error, just filtered
    }

    try {
      const message = this.formatMessage(payload);

      await sendMessageTelegram(chatId, message, {
        accountId: this.config.accountId,
        silent: false, // Alerts should notify
      });

      log.debug(`Telegram alert sent: ${payload.id}`, { chatId });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn(`Telegram notification failed: ${message}`, { chatId });
      return { success: false, error: message };
    }
  }

  /**
   * Format alert payload as a Telegram message.
   */
  private formatMessage(payload: AlertPayload): string {
    const severityEmoji = this.getSeverityEmoji(payload.severity);
    const lines: string[] = [];

    lines.push(`${severityEmoji} **Alert: ${payload.severity.toUpperCase()}**`);
    lines.push("");
    lines.push(payload.message);

    if (payload.context) {
      lines.push("");
      lines.push(`Context: ${payload.context}`);
    }

    if (payload.count > 1) {
      lines.push(`Occurrences: ${payload.count}`);
    }

    lines.push("");
    lines.push(`Time: ${payload.timestamp}`);

    return lines.join("\n");
  }

  /**
   * Get emoji for severity level.
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case "critical":
        return "\u{1F6A8}"; // rotating light
      case "warning":
        return "\u{26A0}\u{FE0F}"; // warning sign
      case "info":
        return "\u{2139}\u{FE0F}"; // info
      default:
        return "\u{2757}"; // exclamation mark
    }
  }
}

/**
 * Create a Telegram notifier from configuration.
 *
 * @returns Notifier instance or null if not configured
 */
export function createTelegramNotifier(config?: AlertingTelegramConfig): TelegramNotifier | null {
  if (!config?.chatId) {
    return null;
  }
  return new TelegramNotifier(config);
}
