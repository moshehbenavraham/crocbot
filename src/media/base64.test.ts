import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_BASE64_BYTES,
  estimateBase64DecodedSize,
  validateBase64Size,
} from "./base64.js";

describe("estimateBase64DecodedSize", () => {
  it("returns 0 for empty string", () => {
    expect(estimateBase64DecodedSize("")).toBe(0);
  });

  it("calculates size for string without padding", () => {
    // "abc" encodes to "YWJj" (4 chars, 3 decoded bytes)
    expect(estimateBase64DecodedSize("YWJj")).toBe(3);
  });

  it("calculates size with single padding", () => {
    // "ab" encodes to "YWI=" (4 chars, 1 padding, 2 decoded bytes)
    expect(estimateBase64DecodedSize("YWI=")).toBe(2);
  });

  it("calculates size with double padding", () => {
    // "a" encodes to "YQ==" (4 chars, 2 padding, 1 decoded byte)
    expect(estimateBase64DecodedSize("YQ==")).toBe(1);
  });

  it("matches actual Buffer.from decode length", () => {
    const original = "Hello, World! This is a test string for base64.";
    const encoded = Buffer.from(original).toString("base64");
    const estimated = estimateBase64DecodedSize(encoded);
    const actual = Buffer.from(encoded, "base64").length;
    expect(estimated).toBe(actual);
  });
});

describe("validateBase64Size", () => {
  it("accepts payload under limit", () => {
    const small = Buffer.from("small payload").toString("base64");
    const result = validateBase64Size(small, 1024);
    expect(result.ok).toBe(true);
  });

  it("accepts payload exactly at limit", () => {
    const data = Buffer.alloc(100);
    const encoded = data.toString("base64");
    const result = validateBase64Size(encoded, 100);
    expect(result.ok).toBe(true);
  });

  it("rejects payload over limit", () => {
    const data = Buffer.alloc(200);
    const encoded = data.toString("base64");
    const result = validateBase64Size(encoded, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.estimatedBytes).toBe(200);
      expect(result.maxBytes).toBe(100);
    }
  });

  it("accepts empty string", () => {
    const result = validateBase64Size("", 100);
    expect(result.ok).toBe(true);
  });

  it("uses DEFAULT_MAX_BASE64_BYTES when no limit specified", () => {
    expect(DEFAULT_MAX_BASE64_BYTES).toBe(50 * 1024 * 1024);
    const small = Buffer.from("ok").toString("base64");
    const result = validateBase64Size(small);
    expect(result.ok).toBe(true);
  });
});
