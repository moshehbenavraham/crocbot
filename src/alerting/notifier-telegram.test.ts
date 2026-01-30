import { afterEach, describe, expect, it, vi } from "vitest";

import type { AlertPayload } from "./notifier.js";
import { createTelegramNotifier, TelegramNotifier } from "./notifier-telegram.js";

// Mock the sendMessageTelegram function
vi.mock("../telegram/send.js", () => ({
  sendMessageTelegram: vi.fn().mockResolvedValue({ messageId: "123", chatId: "456" }),
}));

import { sendMessageTelegram } from "../telegram/send.js";

describe("TelegramNotifier", () => {
  const mockPayload: AlertPayload = {
    id: "test-id-123",
    message: "Test error message",
    severity: "critical",
    timestamp: "2026-01-30T12:00:00.000Z",
    context: "test-context",
    count: 1,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("notify", () => {
    it("sends message to configured chat ID", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      const result = await notifier.notify(mockPayload);

      expect(result.success).toBe(true);
      expect(sendMessageTelegram).toHaveBeenCalledWith(
        "123456789",
        expect.any(String),
        expect.objectContaining({ silent: false }),
      );
    });

    it("uses configured account ID", async () => {
      const notifier = new TelegramNotifier({
        chatId: "123456789",
        accountId: "my-account",
      });
      await notifier.notify(mockPayload);

      expect(sendMessageTelegram).toHaveBeenCalledWith(
        "123456789",
        expect.any(String),
        expect.objectContaining({ accountId: "my-account" }),
      );
    });

    it("formats message with severity and content", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      await notifier.notify(mockPayload);

      const call = vi.mocked(sendMessageTelegram).mock.calls[0];
      const message = call[1];

      expect(message).toContain("CRITICAL");
      expect(message).toContain(mockPayload.message);
      expect(message).toContain(mockPayload.timestamp);
    });

    it("includes context in message when present", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      await notifier.notify(mockPayload);

      const call = vi.mocked(sendMessageTelegram).mock.calls[0];
      const message = call[1];

      expect(message).toContain("Context: test-context");
    });

    it("includes occurrence count when greater than 1", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      await notifier.notify({ ...mockPayload, count: 5 });

      const call = vi.mocked(sendMessageTelegram).mock.calls[0];
      const message = call[1];

      expect(message).toContain("Occurrences: 5");
    });

    it("omits occurrence count when 1", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      await notifier.notify({ ...mockPayload, count: 1 });

      const call = vi.mocked(sendMessageTelegram).mock.calls[0];
      const message = call[1];

      expect(message).not.toContain("Occurrences:");
    });

    it("returns error when chat ID is not configured", async () => {
      const notifier = new TelegramNotifier({ chatId: "" });
      const result = await notifier.notify(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Telegram chat ID not configured");
      expect(sendMessageTelegram).not.toHaveBeenCalled();
    });

    it("returns error when send fails", async () => {
      vi.mocked(sendMessageTelegram).mockRejectedValueOnce(new Error("Send failed"));

      const notifier = new TelegramNotifier({ chatId: "123456789" });
      const result = await notifier.notify(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Send failed");
    });
  });

  describe("severity filtering", () => {
    it("sends critical alerts by default", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      const result = await notifier.notify({ ...mockPayload, severity: "critical" });

      expect(result.success).toBe(true);
      expect(sendMessageTelegram).toHaveBeenCalled();
    });

    it("skips warning alerts by default (minSeverity=critical)", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      const result = await notifier.notify({ ...mockPayload, severity: "warning" });

      expect(result.success).toBe(true); // Filtered, not error
      expect(sendMessageTelegram).not.toHaveBeenCalled();
    });

    it("skips info alerts by default", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      const result = await notifier.notify({ ...mockPayload, severity: "info" });

      expect(result.success).toBe(true);
      expect(sendMessageTelegram).not.toHaveBeenCalled();
    });

    it("sends warning alerts when minSeverity=warning", async () => {
      const notifier = new TelegramNotifier({
        chatId: "123456789",
        minSeverity: "warning",
      });
      const result = await notifier.notify({ ...mockPayload, severity: "warning" });

      expect(result.success).toBe(true);
      expect(sendMessageTelegram).toHaveBeenCalled();
    });

    it("sends info alerts when minSeverity=info", async () => {
      const notifier = new TelegramNotifier({
        chatId: "123456789",
        minSeverity: "info",
      });
      const result = await notifier.notify({ ...mockPayload, severity: "info" });

      expect(result.success).toBe(true);
      expect(sendMessageTelegram).toHaveBeenCalled();
    });

    it("skips info when minSeverity=warning", async () => {
      const notifier = new TelegramNotifier({
        chatId: "123456789",
        minSeverity: "warning",
      });
      const result = await notifier.notify({ ...mockPayload, severity: "info" });

      expect(result.success).toBe(true);
      expect(sendMessageTelegram).not.toHaveBeenCalled();
    });
  });

  describe("severity emoji", () => {
    it("uses rotating light emoji for critical", async () => {
      const notifier = new TelegramNotifier({ chatId: "123456789" });
      await notifier.notify({ ...mockPayload, severity: "critical" });

      const call = vi.mocked(sendMessageTelegram).mock.calls[0];
      const message = call[1];
      expect(message).toContain("\u{1F6A8}"); // rotating light
    });

    it("uses warning sign emoji for warning", async () => {
      const notifier = new TelegramNotifier({
        chatId: "123456789",
        minSeverity: "warning",
      });
      await notifier.notify({ ...mockPayload, severity: "warning" });

      const call = vi.mocked(sendMessageTelegram).mock.calls[0];
      const message = call[1];
      expect(message).toContain("\u{26A0}"); // warning sign
    });

    it("uses info emoji for info", async () => {
      const notifier = new TelegramNotifier({
        chatId: "123456789",
        minSeverity: "info",
      });
      await notifier.notify({ ...mockPayload, severity: "info" });

      const call = vi.mocked(sendMessageTelegram).mock.calls[0];
      const message = call[1];
      expect(message).toContain("\u{2139}"); // info
    });
  });

  describe("name property", () => {
    it("is telegram", () => {
      const notifier = new TelegramNotifier({ chatId: "123" });
      expect(notifier.name).toBe("telegram");
    });
  });
});

describe("createTelegramNotifier", () => {
  it("returns notifier when chat ID is configured", () => {
    const notifier = createTelegramNotifier({ chatId: "123456789" });
    expect(notifier).toBeInstanceOf(TelegramNotifier);
  });

  it("returns null when chat ID is not configured", () => {
    expect(createTelegramNotifier(undefined)).toBeNull();
    expect(createTelegramNotifier({ chatId: "" })).toBeNull();
  });
});
