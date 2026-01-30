import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  markGatewayStarted,
  resetGatewayStartTime,
  incrementMessages,
  incrementErrors,
  getUptimeSeconds,
  metrics,
} from "./gateway.js";
import { getMetrics, resetMetrics } from "./registry.js";

describe("metrics/gateway", () => {
  beforeEach(() => {
    resetGatewayStartTime();
    resetMetrics();
  });

  afterEach(() => {
    resetGatewayStartTime();
    resetMetrics();
  });

  describe("uptime gauge", () => {
    it("returns 0 before gateway is marked started", () => {
      expect(getUptimeSeconds()).toBe(0);
    });

    it("returns positive value after gateway is marked started", async () => {
      markGatewayStarted();
      // Small delay to ensure time passes
      await new Promise((r) => setTimeout(r, 10));
      const uptime = getUptimeSeconds();
      expect(uptime).toBeGreaterThan(0);
    });

    it("includes uptime in metrics output", async () => {
      markGatewayStarted();
      const output = await getMetrics();
      expect(output).toContain("crocbot_uptime_seconds");
    });
  });

  describe("messages counter", () => {
    it("increments message counter with labels", async () => {
      incrementMessages("telegram", "text");
      incrementMessages("telegram", "text");
      incrementMessages("telegram", "media");

      const output = await getMetrics();
      expect(output).toContain("crocbot_messages_total");
      expect(output).toContain('channel="telegram"');
    });

    it("uses default type label when not specified", async () => {
      incrementMessages("telegram");

      const output = await getMetrics();
      expect(output).toContain('type="text"');
    });
  });

  describe("errors counter", () => {
    it("increments error counter with labels", async () => {
      incrementErrors("telegram", "network");
      incrementErrors("telegram", "processing");

      const output = await getMetrics();
      expect(output).toContain("crocbot_errors_total");
      expect(output).toContain('channel="telegram"');
    });

    it("uses default type label when not specified", async () => {
      incrementErrors("telegram");

      const output = await getMetrics();
      expect(output).toContain('type="processing"');
    });
  });

  describe("metrics object", () => {
    it("exposes uptime gauge", () => {
      expect(metrics.uptime).toBeDefined();
    });

    it("exposes messages counter", () => {
      expect(metrics.messages).toBeDefined();
    });

    it("exposes errors counter", () => {
      expect(metrics.errors).toBeDefined();
    });
  });
});
