import { describe, expect, it } from "vitest";
import { secretEqual } from "./secret-equal.js";

describe("secretEqual", () => {
  it("returns true for identical strings", () => {
    expect(secretEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(secretEqual("abc123", "xyz789")).toBe(false);
  });

  it("returns false for different strings of different length", () => {
    expect(secretEqual("short", "a-much-longer-string")).toBe(false);
  });

  it("returns false when provided is undefined", () => {
    expect(secretEqual(undefined, "expected")).toBe(false);
  });

  it("returns false when expected is undefined", () => {
    expect(secretEqual("provided", undefined)).toBe(false);
  });

  it("returns false when both are undefined", () => {
    expect(secretEqual(undefined, undefined)).toBe(false);
  });

  it("returns false when provided is null", () => {
    expect(secretEqual(null, "expected")).toBe(false);
  });

  it("returns false when expected is null", () => {
    expect(secretEqual("provided", null)).toBe(false);
  });

  it("handles empty strings (both empty is equal)", () => {
    expect(secretEqual("", "")).toBe(true);
  });

  it("handles empty vs non-empty", () => {
    expect(secretEqual("", "notempty")).toBe(false);
  });
});
