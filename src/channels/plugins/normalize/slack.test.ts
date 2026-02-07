import { describe, expect, it } from "vitest";

import { looksLikeSlackTargetId } from "./slack.js";

describe("looksLikeSlackTargetId", () => {
  it("matches user mention format", () => {
    expect(looksLikeSlackTargetId("<@U12345678>")).toBe(true);
  });

  it("matches user: prefix", () => {
    expect(looksLikeSlackTargetId("user:U12345678")).toBe(true);
  });

  it("matches channel: prefix", () => {
    expect(looksLikeSlackTargetId("channel:C12345678")).toBe(true);
  });

  it("matches slack: prefix", () => {
    expect(looksLikeSlackTargetId("slack:C12345678")).toBe(true);
  });

  it("matches @ prefix", () => {
    expect(looksLikeSlackTargetId("@someone")).toBe(true);
  });

  it("matches # prefix", () => {
    expect(looksLikeSlackTargetId("#general")).toBe(true);
  });

  it("matches raw channel ID", () => {
    expect(looksLikeSlackTargetId("C12345678")).toBe(true);
  });

  it("matches raw user ID", () => {
    expect(looksLikeSlackTargetId("U12345678")).toBe(true);
  });

  it("matches raw DM ID", () => {
    expect(looksLikeSlackTargetId("D12345678")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(looksLikeSlackTargetId("")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(looksLikeSlackTargetId("hello world")).toBe(false);
  });

  it("rejects short IDs", () => {
    expect(looksLikeSlackTargetId("C1234")).toBe(false);
  });
});
