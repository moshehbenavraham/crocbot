import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorAggregator, getAggregator, resetAggregator } from "./aggregator.js";

describe("ErrorAggregator", () => {
  let aggregator: ErrorAggregator;

  beforeEach(() => {
    aggregator = new ErrorAggregator();
  });

  afterEach(() => {
    aggregator.reset();
  });

  describe("deduplication", () => {
    it("allows first occurrence of an error", () => {
      const result = aggregator.check("test error", "warning");
      expect(result.shouldAlert).toBe(true);
      expect(result.count).toBe(1);
    });

    it("deduplicates identical errors within window", () => {
      const result1 = aggregator.check("test error", "warning");
      expect(result1.shouldAlert).toBe(true);

      const result2 = aggregator.check("test error", "warning");
      expect(result2.shouldAlert).toBe(false);
      expect(result2.reason).toBe("deduplicated");
      expect(result2.count).toBe(2);

      const result3 = aggregator.check("test error", "warning");
      expect(result3.shouldAlert).toBe(false);
      expect(result3.count).toBe(3);
    });

    it("allows different error messages", () => {
      const result1 = aggregator.check("error one", "warning");
      expect(result1.shouldAlert).toBe(true);

      const result2 = aggregator.check("error two", "warning");
      expect(result2.shouldAlert).toBe(true);
    });

    it("uses context for deduplication key", () => {
      const result1 = aggregator.check("test error", "warning", "context1");
      expect(result1.shouldAlert).toBe(true);

      const result2 = aggregator.check("test error", "warning", "context2");
      expect(result2.shouldAlert).toBe(true);

      const result3 = aggregator.check("test error", "warning", "context1");
      expect(result3.shouldAlert).toBe(false);
      expect(result3.reason).toBe("deduplicated");
    });

    it("generates consistent dedupe keys", () => {
      const result1 = aggregator.check("test error", "warning");
      const result2 = aggregator.check("test error", "warning");
      expect(result1.dedupeKey).toBe(result2.dedupeKey);
    });

    it("generates different keys for different messages", () => {
      const result1 = aggregator.check("error one", "warning");
      const result2 = aggregator.check("error two", "warning");
      expect(result1.dedupeKey).not.toBe(result2.dedupeKey);
    });
  });

  describe("deduplication window expiry", () => {
    it("allows alert after window expires", () => {
      vi.useFakeTimers();

      const result1 = aggregator.check("test error", "warning");
      expect(result1.shouldAlert).toBe(true);

      // Within window
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      const result2 = aggregator.check("test error", "warning");
      expect(result2.shouldAlert).toBe(false);

      // After window (5 min default + buffer)
      vi.advanceTimersByTime(2 * 60 * 1000); // +2 minutes = 6 minutes total
      const result3 = aggregator.check("test error", "warning");
      expect(result3.shouldAlert).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("rate limiting", () => {
    it("rate limits critical alerts", () => {
      // Default is 5 critical alerts per window
      for (let i = 0; i < 5; i++) {
        const result = aggregator.check(`critical error ${i}`, "critical");
        expect(result.shouldAlert).toBe(true);
      }

      const result = aggregator.check("critical error 5", "critical");
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe("rate_limited");
    });

    it("rate limits warning alerts", () => {
      // Default is 10 warning alerts per window
      for (let i = 0; i < 10; i++) {
        const result = aggregator.check(`warning error ${i}`, "warning");
        expect(result.shouldAlert).toBe(true);
      }

      const result = aggregator.check("warning error 10", "warning");
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe("rate_limited");
    });

    it("does not rate limit info alerts", () => {
      for (let i = 0; i < 20; i++) {
        const result = aggregator.check(`info error ${i}`, "info");
        expect(result.shouldAlert).toBe(true);
      }
    });

    it("rate limits are per-severity", () => {
      // Fill up critical rate limit
      for (let i = 0; i < 5; i++) {
        aggregator.check(`critical ${i}`, "critical");
      }

      // Warning should still work
      const warningResult = aggregator.check("warning error", "warning");
      expect(warningResult.shouldAlert).toBe(true);

      // But critical is rate limited
      const criticalResult = aggregator.check("critical 5", "critical");
      expect(criticalResult.shouldAlert).toBe(false);
      expect(criticalResult.reason).toBe("rate_limited");
    });

    it("resets rate limit after window expires", () => {
      vi.useFakeTimers();

      // Fill up critical rate limit
      for (let i = 0; i < 5; i++) {
        aggregator.check(`critical ${i}`, "critical");
      }

      const rateLimited = aggregator.check("critical 5", "critical");
      expect(rateLimited.shouldAlert).toBe(false);

      // Advance past rate limit window
      vi.advanceTimersByTime(6 * 60 * 1000);

      const afterWindow = aggregator.check("critical 6", "critical");
      expect(afterWindow.shouldAlert).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("configuration", () => {
    it("respects custom dedupeWindowMs", () => {
      vi.useFakeTimers();
      const customAggregator = new ErrorAggregator({ dedupeWindowMs: 1000 });

      customAggregator.check("test error", "warning");
      vi.advanceTimersByTime(500);
      expect(customAggregator.check("test error", "warning").shouldAlert).toBe(false);

      vi.advanceTimersByTime(600); // Past 1000ms window
      expect(customAggregator.check("test error", "warning").shouldAlert).toBe(true);

      vi.useRealTimers();
    });

    it("respects custom rateLimitCritical", () => {
      const customAggregator = new ErrorAggregator({ rateLimitCritical: 2 });

      customAggregator.check("critical 1", "critical");
      customAggregator.check("critical 2", "critical");
      expect(customAggregator.check("critical 3", "critical").shouldAlert).toBe(false);
    });

    it("respects custom rateLimitWarning", () => {
      const customAggregator = new ErrorAggregator({ rateLimitWarning: 3 });

      customAggregator.check("warning 1", "warning");
      customAggregator.check("warning 2", "warning");
      customAggregator.check("warning 3", "warning");
      expect(customAggregator.check("warning 4", "warning").shouldAlert).toBe(false);
    });

    it("allows runtime config updates", () => {
      aggregator.check("critical 1", "critical");
      aggregator.check("critical 2", "critical");
      aggregator.check("critical 3", "critical");
      aggregator.check("critical 4", "critical");
      aggregator.check("critical 5", "critical");

      expect(aggregator.check("critical 6", "critical").shouldAlert).toBe(false);

      aggregator.updateConfig({ rateLimitCritical: 10 });
      expect(aggregator.check("critical 7", "critical").shouldAlert).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      aggregator.check("test error", "warning");
      aggregator.check("critical 1", "critical");

      expect(aggregator.getStats().dedupeEntries).toBeGreaterThan(0);
      expect(aggregator.getStats().rateLimitEntries).toBeGreaterThan(0);

      aggregator.reset();

      expect(aggregator.getStats().dedupeEntries).toBe(0);
      expect(aggregator.getStats().rateLimitEntries).toBe(0);

      // Same error should alert again
      expect(aggregator.check("test error", "warning").shouldAlert).toBe(true);
    });
  });

  describe("getStats", () => {
    it("returns current entry counts", () => {
      expect(aggregator.getStats()).toEqual({ dedupeEntries: 0, rateLimitEntries: 0 });

      aggregator.check("error 1", "warning");
      expect(aggregator.getStats().dedupeEntries).toBe(1);
      expect(aggregator.getStats().rateLimitEntries).toBe(1);

      aggregator.check("error 2", "critical");
      expect(aggregator.getStats().dedupeEntries).toBe(2);
      expect(aggregator.getStats().rateLimitEntries).toBe(2);
    });
  });
});

describe("global aggregator", () => {
  afterEach(() => {
    resetAggregator();
  });

  it("returns singleton instance", () => {
    const agg1 = getAggregator();
    const agg2 = getAggregator();
    expect(agg1).toBe(agg2);
  });

  it("can be reset", () => {
    const agg1 = getAggregator();
    agg1.check("test error", "warning");

    resetAggregator();

    const agg2 = getAggregator();
    expect(agg2).not.toBe(agg1);
    expect(agg2.getStats().dedupeEntries).toBe(0);
  });

  it("applies config on first call", () => {
    const agg = getAggregator({ rateLimitCritical: 2 });
    agg.check("critical 1", "critical");
    agg.check("critical 2", "critical");
    expect(agg.check("critical 3", "critical").shouldAlert).toBe(false);
  });

  it("updates config on subsequent calls", () => {
    getAggregator({ rateLimitCritical: 1 });
    getAggregator({ rateLimitCritical: 10 });
    const agg = getAggregator();

    // Should be able to send 10 now
    for (let i = 0; i < 10; i++) {
      expect(agg.check(`critical ${i}`, "critical").shouldAlert).toBe(true);
    }
  });
});
