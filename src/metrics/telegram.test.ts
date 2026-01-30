import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { observeLatency, startLatencyTimer, incrementReconnects, metrics } from "./telegram.js";
import { getMetrics, resetMetrics } from "./registry.js";

describe("metrics/telegram", () => {
  beforeEach(() => {
    resetMetrics();
  });

  afterEach(() => {
    resetMetrics();
  });

  describe("latency histogram", () => {
    it("records latency observations", async () => {
      observeLatency(0.5, "text");
      observeLatency(1.2, "text");

      const output = await getMetrics();
      expect(output).toContain("crocbot_telegram_latency_seconds");
    });

    it("uses default type label when not specified", async () => {
      observeLatency(0.1);

      const output = await getMetrics();
      expect(output).toContain('type="text"');
    });

    it("includes histogram buckets", async () => {
      observeLatency(0.05, "text");

      const output = await getMetrics();
      expect(output).toContain("crocbot_telegram_latency_seconds_bucket");
    });
  });

  describe("startLatencyTimer", () => {
    it("returns a function that records elapsed time", async () => {
      const end = startLatencyTimer("command");
      // Small delay
      await new Promise((r) => setTimeout(r, 10));
      const elapsed = end();

      expect(elapsed).toBeGreaterThan(0);

      const output = await getMetrics();
      expect(output).toContain("crocbot_telegram_latency_seconds");
    });

    it("uses default type label when not specified", async () => {
      const end = startLatencyTimer();
      end();

      const output = await getMetrics();
      expect(output).toContain('type="text"');
    });
  });

  describe("reconnects counter", () => {
    it("increments reconnect counter with reason label", async () => {
      incrementReconnects("network");
      incrementReconnects("conflict");
      incrementReconnects("network");

      const output = await getMetrics();
      expect(output).toContain("crocbot_telegram_reconnects_total");
      expect(output).toContain('reason="network"');
      expect(output).toContain('reason="conflict"');
    });

    it("uses default reason label when not specified", async () => {
      incrementReconnects();

      const output = await getMetrics();
      expect(output).toContain('reason="network"');
    });
  });

  describe("metrics object", () => {
    it("exposes latency histogram", () => {
      expect(metrics.latency).toBeDefined();
    });

    it("exposes reconnects counter", () => {
      expect(metrics.reconnects).toBeDefined();
    });
  });
});
