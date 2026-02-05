/**
 * Webhook notifier for alert delivery.
 *
 * Sends alerts via HTTP POST to a configured webhook URL.
 */

import type { AlertingWebhookConfig } from "../config/types.alerting.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import { SsrFBlockedError } from "../infra/net/ssrf.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { AlertPayload, Notifier, NotifyResult } from "./notifier.js";

const log = createSubsystemLogger("alerting/webhook");

/** Default timeout for webhook requests. */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Webhook notifier implementation.
 *
 * Posts alert payloads to a configured URL with optional custom headers.
 */
export class WebhookNotifier implements Notifier {
  readonly name = "webhook";
  private readonly config: AlertingWebhookConfig;

  constructor(config: AlertingWebhookConfig) {
    this.config = config;
  }

  async notify(payload: AlertPayload): Promise<NotifyResult> {
    const url = this.config.url;
    if (!url) {
      return { success: false, error: "Webhook URL not configured" };
    }

    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...this.config.headers,
      };

      const body = JSON.stringify({
        id: payload.id,
        message: payload.message,
        severity: payload.severity,
        timestamp: payload.timestamp,
        context: payload.context,
        count: payload.count,
        stack: payload.stack,
        metadata: payload.metadata,
      });

      const { response, release } = await fetchWithSsrFGuard({
        url,
        timeoutMs,
        init: {
          method: "POST",
          headers,
          body,
        },
      });

      try {
        if (!response.ok) {
          const status = response.status;
          log.warn(`Webhook request failed: ${status}`, { url, status });
          return { success: false, error: `HTTP ${status}` };
        }

        log.debug(`Webhook alert sent: ${payload.id}`, { url });
        return { success: true };
      } finally {
        await release();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isSsrf = err instanceof SsrFBlockedError;
      const errorMsg = isAbort ? "Request timed out" : message;
      if (isSsrf) {
        log.warn(`Webhook request blocked (SSRF): ${message}`, { url });
      } else {
        log.warn(`Webhook request error: ${errorMsg}`, { url });
      }
      return { success: false, error: errorMsg };
    }
  }
}

/**
 * Create a webhook notifier from configuration.
 *
 * @returns Notifier instance or null if not configured
 */
export function createWebhookNotifier(config?: AlertingWebhookConfig): WebhookNotifier | null {
  if (!config?.url) {
    return null;
  }
  return new WebhookNotifier(config);
}
