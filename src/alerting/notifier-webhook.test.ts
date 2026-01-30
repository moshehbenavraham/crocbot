import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AlertPayload } from "./notifier.js";
import { createWebhookNotifier, WebhookNotifier } from "./notifier-webhook.js";

describe("WebhookNotifier", () => {
  const mockPayload: AlertPayload = {
    id: "test-id-123",
    message: "Test error message",
    severity: "critical",
    timestamp: "2026-01-30T12:00:00.000Z",
    context: "test-context",
    count: 1,
    stack: "Error: Test\n    at test.ts:1:1",
    metadata: { foo: "bar" },
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("notify", () => {
    it("sends POST request to configured URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      const notifier = new WebhookNotifier({ url: "https://example.com/webhook" });
      const result = await notifier.notify(mockPayload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: expect.any(String),
        }),
      );
    });

    it("includes payload in request body", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      const notifier = new WebhookNotifier({ url: "https://example.com/webhook" });
      await notifier.notify(mockPayload);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.id).toBe(mockPayload.id);
      expect(body.message).toBe(mockPayload.message);
      expect(body.severity).toBe(mockPayload.severity);
      expect(body.timestamp).toBe(mockPayload.timestamp);
      expect(body.context).toBe(mockPayload.context);
      expect(body.count).toBe(mockPayload.count);
      expect(body.stack).toBe(mockPayload.stack);
      expect(body.metadata).toEqual(mockPayload.metadata);
    });

    it("includes custom headers", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      const notifier = new WebhookNotifier({
        url: "https://example.com/webhook",
        headers: {
          Authorization: "Bearer token123",
          "X-Custom": "value",
        },
      });
      await notifier.notify(mockPayload);

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
        "X-Custom": "value",
      });
    });

    it("returns error for non-ok response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal("fetch", mockFetch);

      const notifier = new WebhookNotifier({ url: "https://example.com/webhook" });
      const result = await notifier.notify(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("HTTP 500");
    });

    it("returns error for network failure", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      const notifier = new WebhookNotifier({ url: "https://example.com/webhook" });
      const result = await notifier.notify(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("handles timeout with AbortError", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      vi.stubGlobal("fetch", mockFetch);

      const notifier = new WebhookNotifier({
        url: "https://example.com/webhook",
        timeoutMs: 100,
      });
      const result = await notifier.notify(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timed out");
    });

    it("uses configured timeout", async () => {
      vi.useFakeTimers();
      let abortSignal: AbortSignal | undefined;
      let _rejectFn: ((reason: Error) => void) | undefined;
      const mockFetch = vi.fn().mockImplementation((_url, options) => {
        abortSignal = options.signal;
        return new Promise((_resolve, reject) => {
          _rejectFn = reject;
          // Abort signal listener to reject the promise
          options.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const notifier = new WebhookNotifier({
        url: "https://example.com/webhook",
        timeoutMs: 1000,
      });

      const notifyPromise = notifier.notify(mockPayload);

      await vi.advanceTimersByTimeAsync(999);
      expect(abortSignal?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(2);
      expect(abortSignal?.aborted).toBe(true);

      vi.useRealTimers();
      const result = await notifyPromise;
      expect(result.success).toBe(false);
    });

    it("uses default timeout of 5000ms", async () => {
      vi.useFakeTimers();
      let abortSignal: AbortSignal | undefined;
      const mockFetch = vi.fn().mockImplementation((_url, options) => {
        abortSignal = options.signal;
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const notifier = new WebhookNotifier({ url: "https://example.com/webhook" });
      const notifyPromise = notifier.notify(mockPayload);

      await vi.advanceTimersByTimeAsync(4999);
      expect(abortSignal?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(2);
      expect(abortSignal?.aborted).toBe(true);

      vi.useRealTimers();
      const result = await notifyPromise;
      expect(result.success).toBe(false);
    });
  });

  describe("name property", () => {
    it("is webhook", () => {
      const notifier = new WebhookNotifier({ url: "https://example.com" });
      expect(notifier.name).toBe("webhook");
    });
  });
});

describe("createWebhookNotifier", () => {
  it("returns notifier when URL is configured", () => {
    const notifier = createWebhookNotifier({ url: "https://example.com/webhook" });
    expect(notifier).toBeInstanceOf(WebhookNotifier);
  });

  it("returns null when URL is not configured", () => {
    expect(createWebhookNotifier(undefined)).toBeNull();
    expect(createWebhookNotifier({ url: "" })).toBeNull();
  });
});
