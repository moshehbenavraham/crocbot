import { describe, expect, it, vi } from "vitest";

import { createLlmRetryOptions, isTransientLlmError, parseLlmRetryAfter } from "./llm-retry.js";
import { retryAsync } from "./retry.js";

// ---------------------------------------------------------------------------
// Error factories
// ---------------------------------------------------------------------------

function createHttpError(
  status: number,
  headers?: Record<string, string>,
): Error & {
  status: number;
  response?: { headers: Record<string, string> };
} {
  const err = new Error(`HTTP ${status}`) as Error & {
    status: number;
    response?: { headers: Record<string, string> };
  };
  err.status = status;
  if (headers) {
    err.response = { headers };
  }
  return err;
}

function createNetworkError(code: string): Error & { code: string } {
  const err = new Error(`Network error: ${code}`) as Error & { code: string };
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// isTransientLlmError
// ---------------------------------------------------------------------------

describe("isTransientLlmError", () => {
  describe("transient HTTP status codes", () => {
    it.each([408, 429, 500, 502, 503, 504])("classifies %d as transient", (status) => {
      const err = createHttpError(status);
      expect(isTransientLlmError(err)).toBe(true);
    });
  });

  describe("non-transient HTTP status codes", () => {
    it.each([400, 401, 403, 404, 422])("classifies %d as non-transient", (status) => {
      const err = createHttpError(status);
      expect(isTransientLlmError(err)).toBe(false);
    });
  });

  describe("network errors", () => {
    it.each(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE", "UND_ERR_CONNECT_TIMEOUT"])(
      "classifies %s as transient",
      (code) => {
        const err = createNetworkError(code);
        expect(isTransientLlmError(err)).toBe(true);
      },
    );

    it("classifies lowercase network codes as transient", () => {
      const err = createNetworkError("econnreset");
      expect(isTransientLlmError(err)).toBe(true);
    });
  });

  describe("network errors in cause chain", () => {
    it("detects network error in cause", () => {
      const cause = createNetworkError("ECONNRESET");
      const err = new Error("request failed", { cause });
      expect(isTransientLlmError(err)).toBe(true);
    });
  });

  describe("no status code and no network code", () => {
    it("classifies plain Error as non-transient", () => {
      expect(isTransientLlmError(new Error("something went wrong"))).toBe(false);
    });

    it("classifies null as non-transient", () => {
      expect(isTransientLlmError(null)).toBe(false);
    });

    it("classifies undefined as non-transient", () => {
      expect(isTransientLlmError(undefined)).toBe(false);
    });

    it("classifies string as non-transient", () => {
      expect(isTransientLlmError("error")).toBe(false);
    });
  });

  describe("statusCode property (alternative name)", () => {
    it("reads from statusCode property", () => {
      const err = { statusCode: 429, message: "too many requests" };
      expect(isTransientLlmError(err)).toBe(true);
    });

    it("reads string statusCode", () => {
      const err = { statusCode: "503", message: "unavailable" };
      expect(isTransientLlmError(err)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// parseLlmRetryAfter
// ---------------------------------------------------------------------------

describe("parseLlmRetryAfter", () => {
  describe("numeric seconds", () => {
    it("parses Retry-After: 30 as 30000ms", () => {
      const err = createHttpError(429, { "retry-after": "30" });
      expect(parseLlmRetryAfter(err)).toBe(30000);
    });

    it("parses Retry-After: 1 as 1000ms", () => {
      const err = createHttpError(429, { "retry-after": "1" });
      expect(parseLlmRetryAfter(err)).toBe(1000);
    });

    it("parses fractional seconds", () => {
      const err = createHttpError(429, { "retry-after": "0.5" });
      expect(parseLlmRetryAfter(err)).toBe(500);
    });
  });

  describe("zero or negative values", () => {
    it("returns undefined for Retry-After: 0", () => {
      const err = createHttpError(429, { "retry-after": "0" });
      expect(parseLlmRetryAfter(err)).toBeUndefined();
    });

    it("returns undefined for negative values", () => {
      const err = createHttpError(429, { "retry-after": "-5" });
      expect(parseLlmRetryAfter(err)).toBeUndefined();
    });
  });

  describe("HTTP-date format", () => {
    it("parses absolute date and returns delta", () => {
      const future = new Date(Date.now() + 10_000).toUTCString();
      const err = createHttpError(429, { "retry-after": future });
      const result = parseLlmRetryAfter(err);

      expect(result).toBeDefined();
      // Should be roughly 10 seconds (within tolerance for test execution time)
      expect(result!).toBeGreaterThan(8000);
      expect(result!).toBeLessThanOrEqual(11000);
    });

    it("returns undefined for past date", () => {
      const past = new Date(Date.now() - 10_000).toUTCString();
      const err = createHttpError(429, { "retry-after": past });
      expect(parseLlmRetryAfter(err)).toBeUndefined();
    });
  });

  describe("cap at maxDelayMs", () => {
    it("caps large seconds at maxDelayMs", () => {
      const err = createHttpError(429, { "retry-after": "120" });
      const result = parseLlmRetryAfter(err, 10_000);
      expect(result).toBe(10_000);
    });
  });

  describe("header extraction", () => {
    it("extracts from err.response.headers", () => {
      const err = createHttpError(429, { "retry-after": "5" });
      expect(parseLlmRetryAfter(err)).toBe(5000);
    });

    it("extracts from err.headers directly", () => {
      const err = { status: 429, headers: { "retry-after": "5" }, message: "too many" };
      expect(parseLlmRetryAfter(err)).toBe(5000);
    });

    it("extracts from err.retryAfterMs", () => {
      const err = { status: 429, retryAfterMs: 5000, message: "too many" };
      expect(parseLlmRetryAfter(err)).toBe(5000);
    });

    it("caps retryAfterMs at maxDelayMs", () => {
      const err = { status: 429, retryAfterMs: 60_000, message: "too many" };
      expect(parseLlmRetryAfter(err, 10_000)).toBe(10_000);
    });

    it("uses case-insensitive header lookup", () => {
      const err = {
        status: 429,
        response: { headers: { "Retry-After": "5" } },
        message: "too many",
      };
      expect(parseLlmRetryAfter(err)).toBe(5000);
    });
  });

  describe("no Retry-After", () => {
    it("returns undefined for error with no headers", () => {
      const err = createHttpError(429);
      expect(parseLlmRetryAfter(err)).toBeUndefined();
    });

    it("returns undefined for null input", () => {
      expect(parseLlmRetryAfter(null)).toBeUndefined();
    });

    it("returns undefined for undefined input", () => {
      expect(parseLlmRetryAfter(undefined)).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// createLlmRetryOptions
// ---------------------------------------------------------------------------

describe("createLlmRetryOptions", () => {
  describe("defaults", () => {
    it("returns correct default values", () => {
      const options = createLlmRetryOptions();

      expect(options.attempts).toBe(3);
      expect(options.minDelayMs).toBe(300);
      expect(options.maxDelayMs).toBe(30_000);
      expect(options.jitter).toBe(0.25);
      expect(options.shouldRetry).toBeDefined();
      expect(options.retryAfterMs).toBeDefined();
    });
  });

  describe("overrides", () => {
    it("allows overriding attempts", () => {
      const options = createLlmRetryOptions({ attempts: 5 });
      expect(options.attempts).toBe(5);
    });

    it("allows overriding minDelayMs", () => {
      const options = createLlmRetryOptions({ minDelayMs: 1000 });
      expect(options.minDelayMs).toBe(1000);
    });

    it("allows overriding maxDelayMs", () => {
      const options = createLlmRetryOptions({ maxDelayMs: 60_000 });
      expect(options.maxDelayMs).toBe(60_000);
    });

    it("allows overriding jitter", () => {
      const options = createLlmRetryOptions({ jitter: 0.5 });
      expect(options.jitter).toBe(0.5);
    });

    it("allows setting a label", () => {
      const options = createLlmRetryOptions({ label: "chat-completion" });
      expect(options.label).toBe("chat-completion");
    });

    it("allows setting an onRetry callback", () => {
      const onRetry = vi.fn();
      const options = createLlmRetryOptions({ onRetry });
      expect(options.onRetry).toBe(onRetry);
    });
  });

  describe("shouldRetry integration", () => {
    it("delegates to isTransientLlmError", () => {
      const options = createLlmRetryOptions();
      const transient = createHttpError(429);
      const permanent = createHttpError(401);

      expect(options.shouldRetry!(transient, 1)).toBe(true);
      expect(options.shouldRetry!(permanent, 1)).toBe(false);
    });
  });

  describe("retryAfterMs integration", () => {
    it("delegates to parseLlmRetryAfter", () => {
      const options = createLlmRetryOptions();
      const err = createHttpError(429, { "retry-after": "10" });

      expect(options.retryAfterMs!(err)).toBe(10_000);
    });

    it("respects maxDelayMs override in retry-after parsing", () => {
      const options = createLlmRetryOptions({ maxDelayMs: 5000 });
      const err = createHttpError(429, { "retry-after": "60" });

      expect(options.retryAfterMs!(err)).toBe(5000);
    });
  });

  describe("integration with retryAsync", () => {
    it("retries on transient error and succeeds", async () => {
      let callCount = 0;
      const fn = async (): Promise<string> => {
        callCount++;
        if (callCount < 3) {
          throw createHttpError(503);
        }
        return "success";
      };

      const options = createLlmRetryOptions({
        attempts: 3,
        minDelayMs: 1,
        maxDelayMs: 10,
        jitter: 0,
      });

      const result = await retryAsync(fn, options);
      expect(result).toBe("success");
      expect(callCount).toBe(3);
    });

    it("does not retry on permanent error", async () => {
      let callCount = 0;
      const fn = async (): Promise<string> => {
        callCount++;
        throw createHttpError(401);
      };

      const options = createLlmRetryOptions({
        attempts: 3,
        minDelayMs: 1,
        maxDelayMs: 10,
        jitter: 0,
      });

      await expect(retryAsync(fn, options)).rejects.toThrow("HTTP 401");
      expect(callCount).toBe(1);
    });

    it("exhausts max attempts and throws last error", async () => {
      let callCount = 0;
      const fn = async (): Promise<string> => {
        callCount++;
        throw createHttpError(500);
      };

      const options = createLlmRetryOptions({
        attempts: 3,
        minDelayMs: 1,
        maxDelayMs: 10,
        jitter: 0,
      });

      await expect(retryAsync(fn, options)).rejects.toThrow("HTTP 500");
      expect(callCount).toBe(3);
    });

    it("calls onRetry for each retry attempt", async () => {
      let callCount = 0;
      const fn = async (): Promise<string> => {
        callCount++;
        if (callCount < 3) {
          throw createHttpError(502);
        }
        return "ok";
      };

      const onRetry = vi.fn();
      const options = createLlmRetryOptions({
        attempts: 3,
        minDelayMs: 1,
        maxDelayMs: 10,
        jitter: 0,
        onRetry,
      });

      await retryAsync(fn, options);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });
  });
});
