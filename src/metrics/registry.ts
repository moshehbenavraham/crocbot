/**
 * Central metrics registry for Prometheus-compatible metrics.
 *
 * Provides a singleton Registry instance and helper functions
 * for creating and exposing metrics in Prometheus exposition format.
 */

import {
  Registry,
  collectDefaultMetrics,
  type Counter,
  type Gauge,
  type Histogram,
} from "prom-client";

// Singleton registry for all crocbot metrics
const registry = new Registry();

// Track whether default metrics have been enabled
let defaultMetricsEnabled = false;

/**
 * Enable default Node.js runtime metrics (memory, GC, event loop, etc.)
 * These metrics use the `nodejs_` prefix.
 *
 * Call this once during gateway startup.
 */
export function enableDefaultMetrics(): void {
  if (defaultMetricsEnabled) return;
  collectDefaultMetrics({ register: registry });
  defaultMetricsEnabled = true;
}

/**
 * Get the singleton metrics registry.
 */
export function getRegistry(): Registry {
  return registry;
}

/**
 * Get all metrics in Prometheus exposition format.
 * Returns a string suitable for the /metrics HTTP response.
 */
export async function getMetrics(): Promise<string> {
  return registry.metrics();
}

/**
 * Get the content type for the metrics response.
 * Prometheus expects: text/plain; version=0.0.4; charset=utf-8
 */
export function getMetricsContentType(): string {
  return registry.contentType;
}

/**
 * Reset all metrics in the registry.
 * Primarily used for testing.
 */
export function resetMetrics(): void {
  registry.resetMetrics();
}

/**
 * Clear all metrics from the registry.
 * Primarily used for testing.
 */
export function clearMetrics(): void {
  registry.clear();
  defaultMetricsEnabled = false;
}

// Re-export types for convenience
export type { Counter, Gauge, Histogram, Registry };
