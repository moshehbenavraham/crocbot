/**
 * Gateway-specific metrics for crocbot.
 *
 * Tracks uptime, message counts, and error counts.
 */

import { Counter, Gauge } from "prom-client";
import { getRegistry } from "./registry.js";

// Gateway startup timestamp for uptime calculation
let gatewayStartTime: number | null = null;

/**
 * Gauge: crocbot_uptime_seconds
 * Current gateway uptime in seconds.
 */
const uptimeGauge = new Gauge({
  name: "crocbot_uptime_seconds",
  help: "Gateway uptime in seconds",
  registers: [getRegistry()],
  collect() {
    if (gatewayStartTime !== null) {
      this.set((Date.now() - gatewayStartTime) / 1000);
    }
  },
});

/**
 * Counter: crocbot_messages_total
 * Total number of messages processed by the gateway.
 */
const messagesCounter = new Counter({
  name: "crocbot_messages_total",
  help: "Total messages processed",
  labelNames: ["channel", "type"] as const,
  registers: [getRegistry()],
});

/**
 * Counter: crocbot_errors_total
 * Total number of errors encountered during message processing.
 */
const errorsCounter = new Counter({
  name: "crocbot_errors_total",
  help: "Total errors encountered",
  labelNames: ["channel", "type"] as const,
  registers: [getRegistry()],
});

/**
 * Mark the gateway as started. Sets the uptime baseline.
 * Call this once during gateway initialization.
 */
export function markGatewayStarted(): void {
  gatewayStartTime = Date.now();
}

/**
 * Reset gateway start time. Used for testing.
 */
export function resetGatewayStartTime(): void {
  gatewayStartTime = null;
}

/**
 * Increment the messages counter.
 *
 * @param channel - The channel (e.g., "telegram")
 * @param type - The message type (e.g., "text", "media", "command")
 */
export function incrementMessages(channel: string, type: string = "text"): void {
  messagesCounter.inc({ channel, type });
}

/**
 * Increment the errors counter.
 *
 * @param channel - The channel where the error occurred
 * @param type - The error type (e.g., "processing", "network", "timeout")
 */
export function incrementErrors(channel: string, type: string = "processing"): void {
  errorsCounter.inc({ channel, type });
}

/**
 * Get the current uptime in seconds.
 * Returns 0 if gateway hasn't started.
 */
export function getUptimeSeconds(): number {
  if (gatewayStartTime === null) return 0;
  return (Date.now() - gatewayStartTime) / 1000;
}

// Export metric instances for testing
export const metrics = {
  uptime: uptimeGauge,
  messages: messagesCounter,
  errors: errorsCounter,
};
