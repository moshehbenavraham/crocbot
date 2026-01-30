/**
 * Telegram-specific metrics for crocbot.
 *
 * Tracks message handling latency and reconnection events.
 */

import { Counter, Histogram } from "prom-client";
import { getRegistry } from "./registry.js";

// Histogram bucket boundaries for latency (in seconds)
// Covers range from 10ms to 10s with reasonable granularity
const LATENCY_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Histogram: crocbot_telegram_latency_seconds
 * Message handling latency in seconds.
 */
const latencyHistogram = new Histogram({
  name: "crocbot_telegram_latency_seconds",
  help: "Telegram message handling latency in seconds",
  labelNames: ["type"] as const,
  buckets: LATENCY_BUCKETS,
  registers: [getRegistry()],
});

/**
 * Counter: crocbot_telegram_reconnects_total
 * Total number of Telegram bot reconnection attempts.
 */
const reconnectsCounter = new Counter({
  name: "crocbot_telegram_reconnects_total",
  help: "Total Telegram reconnection attempts",
  labelNames: ["reason"] as const,
  registers: [getRegistry()],
});

/**
 * Record a message handling latency observation.
 *
 * @param durationSeconds - The latency in seconds
 * @param type - The message type (e.g., "text", "media", "command")
 */
export function observeLatency(durationSeconds: number, type: string = "text"): void {
  latencyHistogram.observe({ type }, durationSeconds);
}

/**
 * Start a timer for measuring latency. Returns a function that,
 * when called, records the elapsed time.
 *
 * @param type - The message type
 * @returns A function to call when processing completes
 */
export function startLatencyTimer(type: string = "text"): () => number {
  return latencyHistogram.startTimer({ type });
}

/**
 * Increment the reconnection counter.
 *
 * @param reason - The reason for reconnection (e.g., "conflict", "network", "timeout")
 */
export function incrementReconnects(reason: string = "network"): void {
  reconnectsCounter.inc({ reason });
}

// Export metric instances for testing
export const metrics = {
  latency: latencyHistogram,
  reconnects: reconnectsCounter,
};
