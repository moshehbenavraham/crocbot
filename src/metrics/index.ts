/**
 * Metrics module public API.
 *
 * Provides Prometheus-compatible metrics for crocbot observability.
 */

// Registry functions
export {
  enableDefaultMetrics,
  getRegistry,
  getMetrics,
  getMetricsContentType,
  resetMetrics,
  clearMetrics,
} from "./registry.js";

// Gateway metrics
export {
  markGatewayStarted,
  resetGatewayStartTime,
  incrementMessages,
  incrementErrors,
  getUptimeSeconds,
} from "./gateway.js";

// Telegram metrics
export { observeLatency, startLatencyTimer, incrementReconnects } from "./telegram.js";
