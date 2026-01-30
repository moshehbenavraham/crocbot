import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNotifierCount,
  initializeReporter,
  isReporterInitialized,
  reportError,
  resetReporter,
} from "./reporter.js";
import { resetAggregator } from "./aggregator.js";

// Mock dependencies
vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({
    gateway: {
      alerting: {
        enabled: true,
      },
    },
  }),
}));

vi.mock("../telegram/send.js", () => ({
  sendMessageTelegram: vi.fn().mockResolvedValue({ messageId: "123", chatId: "456" }),
}));

vi.mock("../metrics/gateway.js", () => ({
  incrementErrorsWithSeverity: vi.fn(),
}));

import { incrementErrorsWithSeverity } from "../metrics/gateway.js";
import { sendMessageTelegram } from "../telegram/send.js";

describe("ErrorReporter", () => {
  beforeEach(() => {
    resetReporter();
    resetAggregator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetReporter();
    resetAggregator();
    vi.clearAllMocks();
  });

  describe("initializeReporter", () => {
    it("sets initialized flag", () => {
      expect(isReporterInitialized()).toBe(false);
      initializeReporter({ enabled: true });
      expect(isReporterInitialized()).toBe(true);
    });

    it("creates no notifiers when none configured", () => {
      initializeReporter({ enabled: true });
      expect(getNotifierCount()).toBe(0);
    });

    it("creates webhook notifier when configured", () => {
      initializeReporter({
        enabled: true,
        webhook: { url: "https://example.com/webhook" },
      });
      expect(getNotifierCount()).toBe(1);
    });

    it("creates telegram notifier when configured", () => {
      initializeReporter({
        enabled: true,
        telegram: { chatId: "123456789" },
      });
      expect(getNotifierCount()).toBe(1);
    });

    it("creates both notifiers when both configured", () => {
      initializeReporter({
        enabled: true,
        webhook: { url: "https://example.com/webhook" },
        telegram: { chatId: "123456789" },
      });
      expect(getNotifierCount()).toBe(2);
    });

    it("sets enabled=false when configured", () => {
      initializeReporter({
        enabled: false,
        webhook: { url: "https://example.com/webhook" },
      });
      expect(getNotifierCount()).toBe(0);
    });
  });

  describe("reportError", () => {
    it("updates metrics regardless of alerting state", async () => {
      initializeReporter({ enabled: false });
      await reportError(new Error("Test error"), { context: "test" });

      expect(incrementErrorsWithSeverity).toHaveBeenCalledWith("test", "info");
    });

    it("returns disabled reason when alerting is off", async () => {
      initializeReporter({ enabled: false });
      const result = await reportError(new Error("Test error"));

      expect(result.alerted).toBe(false);
      expect(result.reason).toBe("disabled");
    });

    it("returns no_notifiers reason when none configured", async () => {
      initializeReporter({ enabled: true });
      const result = await reportError(new Error("Test error"));

      expect(result.alerted).toBe(false);
      expect(result.reason).toBe("no_notifiers");
    });

    it("classifies errors automatically", async () => {
      initializeReporter({ enabled: true });

      const fatalResult = await reportError(new Error("Fatal error occurred"));
      expect(fatalResult.severity).toBe("critical");

      const timeoutResult = await reportError(new Error("Request timeout"));
      expect(timeoutResult.severity).toBe("warning");

      const genericResult = await reportError(new Error("Something went wrong"));
      expect(genericResult.severity).toBe("info");
    });

    it("respects severity override", async () => {
      initializeReporter({ enabled: true });

      const result = await reportError(new Error("Generic error"), {
        severity: "critical",
      });

      expect(result.severity).toBe("critical");
    });

    it("deduplicates identical errors", async () => {
      initializeReporter({
        enabled: true,
        webhook: { url: "https://example.com/webhook" },
      });

      // Mock fetch for webhook
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      const result1 = await reportError(new Error("Same error"));
      const result2 = await reportError(new Error("Same error"));

      expect(result1.alerted).toBe(true);
      expect(result2.alerted).toBe(false);
      expect(result2.reason).toBe("deduplicated");

      vi.unstubAllGlobals();
    });

    it("sends to configured notifiers", async () => {
      initializeReporter({
        enabled: true,
        telegram: { chatId: "123456789", minSeverity: "info" },
      });

      const result = await reportError(new Error("Test error"), {
        context: "test-context",
      });

      expect(result.alerted).toBe(true);
      expect(result.alertId).toBeDefined();
      expect(sendMessageTelegram).toHaveBeenCalled();
    });

    it("handles notifier failures gracefully", async () => {
      vi.mocked(sendMessageTelegram).mockRejectedValueOnce(new Error("Send failed"));

      initializeReporter({
        enabled: true,
        telegram: { chatId: "123456789", minSeverity: "info" },
      });

      const result = await reportError(new Error("Test error"));

      expect(result.alerted).toBe(true); // Still considered alerted
    });

    it("auto-initializes if not initialized", async () => {
      expect(isReporterInitialized()).toBe(false);
      await reportError(new Error("Test error"));
      expect(isReporterInitialized()).toBe(true);
    });

    it("handles various error types", async () => {
      initializeReporter({ enabled: true });

      const errorResult = await reportError(new Error("Error object"));
      expect(errorResult.severity).toBe("info");

      const stringResult = await reportError("String error");
      expect(stringResult.severity).toBe("info");

      const objectResult = await reportError({ message: "Object with message" });
      expect(objectResult.severity).toBe("info");

      const nullResult = await reportError(null);
      expect(nullResult.severity).toBe("info");
    });
  });

  describe("resetReporter", () => {
    it("clears all state", () => {
      initializeReporter({
        enabled: true,
        webhook: { url: "https://example.com/webhook" },
      });

      expect(isReporterInitialized()).toBe(true);
      expect(getNotifierCount()).toBe(1);

      resetReporter();

      expect(isReporterInitialized()).toBe(false);
      expect(getNotifierCount()).toBe(0);
    });
  });

  describe("rate limiting integration", () => {
    it("rate limits after threshold exceeded", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      initializeReporter({
        enabled: true,
        webhook: { url: "https://example.com/webhook" },
        rateLimitCritical: 2,
      });

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(
          await reportError(new Error(`Fatal error ${i}`), {
            severity: "critical",
          }),
        );
      }

      expect(results[0].alerted).toBe(true);
      expect(results[1].alerted).toBe(true);
      expect(results[2].alerted).toBe(false);
      expect(results[2].reason).toBe("rate_limited");

      vi.unstubAllGlobals();
    });
  });
});
