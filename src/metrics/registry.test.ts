import { describe, it, expect, afterEach } from "vitest";
import {
  getRegistry,
  getMetrics,
  getMetricsContentType,
  enableDefaultMetrics,
  resetMetrics,
} from "./registry.js";
// Import gateway and telegram to ensure metrics are registered
import "./gateway.js";
import "./telegram.js";

describe("metrics/registry", () => {
  afterEach(() => {
    // Reset metrics after each test but don't clear
    resetMetrics();
  });

  describe("getRegistry", () => {
    it("returns the singleton registry", () => {
      const registry1 = getRegistry();
      const registry2 = getRegistry();
      expect(registry1).toBe(registry2);
    });
  });

  describe("getMetrics", () => {
    it("returns metrics in Prometheus format", async () => {
      const output = await getMetrics();
      expect(typeof output).toBe("string");
    });

    it("includes custom metrics when defined", async () => {
      const output = await getMetrics();
      expect(output).toContain("crocbot_uptime_seconds");
    });
  });

  describe("getMetricsContentType", () => {
    it("returns Prometheus content type", () => {
      const contentType = getMetricsContentType();
      expect(contentType).toContain("text/plain");
    });
  });

  describe("enableDefaultMetrics", () => {
    it("enables Node.js runtime metrics", async () => {
      enableDefaultMetrics();
      const output = await getMetrics();
      // Default metrics include process and nodejs prefixed metrics
      expect(output).toContain("process_");
    });

    it("is idempotent - can be called multiple times safely", () => {
      enableDefaultMetrics();
      enableDefaultMetrics();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("resetMetrics", () => {
    it("resets all metric values without removing them", async () => {
      // Get initial metrics
      const before = await getMetrics();
      expect(before).toContain("crocbot_uptime_seconds");

      resetMetrics();

      // Metrics should still exist after reset
      const after = await getMetrics();
      expect(after).toContain("crocbot_uptime_seconds");
    });
  });
});
