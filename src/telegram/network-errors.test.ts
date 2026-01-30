import { describe, expect, it } from "vitest";

import { isRecoverableTelegramNetworkError } from "./network-errors.js";

describe("isRecoverableTelegramNetworkError", () => {
  it("detects recoverable error codes", () => {
    const err = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("detects AbortError names", () => {
    const err = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("detects nested causes", () => {
    const cause = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    const err = Object.assign(new TypeError("fetch failed"), { cause });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("skips message matches for send context", () => {
    const err = new TypeError("fetch failed");
    expect(isRecoverableTelegramNetworkError(err, { context: "send" })).toBe(false);
    expect(isRecoverableTelegramNetworkError(err, { context: "polling" })).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isRecoverableTelegramNetworkError(new Error("invalid token"))).toBe(false);
  });

  it("detects HTTP 429 rate limit errors", () => {
    const err = Object.assign(new Error("Too Many Requests"), { error_code: 429 });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("detects HTTP 502 Bad Gateway errors", () => {
    const err = Object.assign(new Error("Bad Gateway"), { error_code: 502 });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("detects HTTP 503 Service Unavailable errors", () => {
    const err = Object.assign(new Error("Service Unavailable"), { error_code: 503 });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("detects HTTP 504 Gateway Timeout errors", () => {
    const err = Object.assign(new Error("Gateway Timeout"), { error_code: 504 });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("detects HTTP status codes via errorCode property", () => {
    const err = Object.assign(new Error("Rate limited"), { errorCode: 429 });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("detects HTTP status codes in nested cause", () => {
    const cause = Object.assign(new Error("Too Many Requests"), { error_code: 429 });
    const err = Object.assign(new Error("Request failed"), { cause });
    expect(isRecoverableTelegramNetworkError(err)).toBe(true);
  });

  it("does not treat 400 or 401 as recoverable", () => {
    const err400 = Object.assign(new Error("Bad Request"), { error_code: 400 });
    const err401 = Object.assign(new Error("Unauthorized"), { error_code: 401 });
    expect(isRecoverableTelegramNetworkError(err400)).toBe(false);
    expect(isRecoverableTelegramNetworkError(err401)).toBe(false);
  });
});
