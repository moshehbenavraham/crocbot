import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildJsonLogEntry,
  isJsonFormatEnabled,
  resetLogFormat,
  resolveLogFormat,
} from "./format.js";

describe("resolveLogFormat", () => {
  const originalEnv = process.env.CROCBOT_LOG_FORMAT;

  beforeEach(() => {
    resetLogFormat();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CROCBOT_LOG_FORMAT;
    } else {
      process.env.CROCBOT_LOG_FORMAT = originalEnv;
    }
    resetLogFormat();
  });

  it("returns 'pretty' by default", () => {
    delete process.env.CROCBOT_LOG_FORMAT;
    expect(resolveLogFormat()).toBe("pretty");
  });

  it("returns 'json' when env var is 'json'", () => {
    process.env.CROCBOT_LOG_FORMAT = "json";
    expect(resolveLogFormat()).toBe("json");
  });

  it("returns 'json' when env var is 'JSON' (case insensitive)", () => {
    process.env.CROCBOT_LOG_FORMAT = "JSON";
    expect(resolveLogFormat()).toBe("json");
  });

  it("returns 'pretty' for other values", () => {
    process.env.CROCBOT_LOG_FORMAT = "text";
    expect(resolveLogFormat()).toBe("pretty");
  });

  it("caches the resolved format", () => {
    process.env.CROCBOT_LOG_FORMAT = "json";
    expect(resolveLogFormat()).toBe("json");
    process.env.CROCBOT_LOG_FORMAT = "pretty";
    // Should still return cached value
    expect(resolveLogFormat()).toBe("json");
  });
});

describe("isJsonFormatEnabled", () => {
  const originalEnv = process.env.CROCBOT_LOG_FORMAT;

  beforeEach(() => {
    resetLogFormat();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CROCBOT_LOG_FORMAT;
    } else {
      process.env.CROCBOT_LOG_FORMAT = originalEnv;
    }
    resetLogFormat();
  });

  it("returns false by default", () => {
    delete process.env.CROCBOT_LOG_FORMAT;
    expect(isJsonFormatEnabled()).toBe(false);
  });

  it("returns true when json format is enabled", () => {
    process.env.CROCBOT_LOG_FORMAT = "json";
    expect(isJsonFormatEnabled()).toBe(true);
  });
});

describe("buildJsonLogEntry", () => {
  it("builds minimal log entry", () => {
    const entry = buildJsonLogEntry({
      level: "info",
      message: "Test message",
      timestamp: new Date("2026-01-30T10:00:00.000Z"),
    });
    expect(entry).toMatchObject({
      time: "2026-01-30T10:00:00.000Z",
      level: "info",
      message: "Test message",
    });
  });

  it("includes subsystem when provided", () => {
    const entry = buildJsonLogEntry({
      level: "info",
      message: "Test",
      subsystem: "gateway/telegram",
      timestamp: new Date("2026-01-30T10:00:00.000Z"),
    });
    expect(entry.subsystem).toBe("gateway/telegram");
  });

  it("includes correlation context when provided", () => {
    const entry = buildJsonLogEntry({
      level: "info",
      message: "Test",
      correlationId: "abc12345",
      chatId: 123,
      userId: 456,
      messageId: 789,
      timestamp: new Date("2026-01-30T10:00:00.000Z"),
    });
    expect(entry.correlation_id).toBe("abc12345");
    expect(entry.chat_id).toBe(123);
    expect(entry.user_id).toBe(456);
    expect(entry.message_id).toBe(789);
  });

  it("includes additional metadata", () => {
    const entry = buildJsonLogEntry({
      level: "info",
      message: "Test",
      meta: { custom: "value", count: 42 },
      timestamp: new Date("2026-01-30T10:00:00.000Z"),
    });
    expect(entry.custom).toBe("value");
    expect(entry.count).toBe(42);
  });

  it("uses current timestamp when not provided", () => {
    const before = new Date();
    const entry = buildJsonLogEntry({
      level: "info",
      message: "Test",
    });
    const after = new Date();
    const entryTime = new Date(entry.time as string);
    expect(entryTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(entryTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("omits undefined fields", () => {
    const entry = buildJsonLogEntry({
      level: "info",
      message: "Test",
      timestamp: new Date("2026-01-30T10:00:00.000Z"),
    });
    expect(Object.keys(entry)).toEqual(["time", "level", "message"]);
  });
});
