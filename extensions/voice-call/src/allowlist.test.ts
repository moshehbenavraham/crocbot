import { describe, expect, it } from "vitest";

import { normalizePhoneNumber, isAllowlistedCaller } from "./allowlist.js";

describe("normalizePhoneNumber", () => {
  it("strips non-digit characters", () => {
    expect(normalizePhoneNumber("+1 (555) 000-1234")).toBe("15550001234");
  });

  it("returns empty string for undefined", () => {
    expect(normalizePhoneNumber(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizePhoneNumber("")).toBe("");
  });

  it("preserves digits-only input", () => {
    expect(normalizePhoneNumber("15550001234")).toBe("15550001234");
  });

  it("returns empty string for non-digit input", () => {
    expect(normalizePhoneNumber("+++---")).toBe("");
  });

  it("handles international format", () => {
    expect(normalizePhoneNumber("+44 20 7946 0958")).toBe("442079460958");
  });
});

describe("isAllowlistedCaller", () => {
  it("returns true for exact match after normalization", () => {
    expect(isAllowlistedCaller("15550001234", ["+1-555-000-1234"])).toBe(true);
  });

  it("returns false for empty normalizedFrom", () => {
    expect(isAllowlistedCaller("", ["+15550001234"])).toBe(false);
  });

  it("returns false for undefined allowFrom", () => {
    expect(isAllowlistedCaller("15550001234", undefined)).toBe(false);
  });

  it("returns false for empty allowFrom array", () => {
    expect(isAllowlistedCaller("15550001234", [])).toBe(false);
  });

  it("rejects partial suffix matches (old endsWith bug)", () => {
    expect(isAllowlistedCaller("15550004567", ["+4567"])).toBe(false);
    expect(isAllowlistedCaller("4567", ["+15550004567"])).toBe(false);
  });

  it("returns false when allowlist entry normalizes to empty", () => {
    expect(isAllowlistedCaller("15550001234", ["+++"])).toBe(false);
  });

  it("matches any entry in the allowlist", () => {
    expect(
      isAllowlistedCaller("15550001234", ["+15559999999", "+15550001234"]),
    ).toBe(true);
  });

  it("returns false when no entries match", () => {
    expect(
      isAllowlistedCaller("15550001234", ["+15559999999", "+15558888888"]),
    ).toBe(false);
  });
});
