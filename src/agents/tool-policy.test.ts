import { describe, expect, it } from "vitest";
import {
  DEFAULT_GATEWAY_HTTP_TOOL_DENY,
  expandToolGroups,
  isDangerousHttpTool,
  isReadSearchOnly,
  resolveToolProfilePolicy,
  TOOL_GROUPS,
} from "./tool-policy.js";

describe("tool-policy", () => {
  it("expands groups and normalizes aliases", () => {
    const expanded = expandToolGroups(["group:runtime", "BASH", "apply-patch", "group:fs"]);
    const set = new Set(expanded);
    expect(set.has("exec")).toBe(true);
    expect(set.has("process")).toBe(true);
    expect(set.has("bash")).toBe(false);
    expect(set.has("apply_patch")).toBe(true);
    expect(set.has("read")).toBe(true);
    expect(set.has("write")).toBe(true);
    expect(set.has("edit")).toBe(true);
  });

  it("resolves known profiles and ignores unknown ones", () => {
    const coding = resolveToolProfilePolicy("coding");
    expect(coding?.allow).toContain("group:fs");
    expect(resolveToolProfilePolicy("nope")).toBeUndefined();
  });

  it("includes core tool groups in group:crocbot", () => {
    const group = TOOL_GROUPS["group:crocbot"];
    expect(group).toContain("browser");
    expect(group).toContain("message");
    expect(group).toContain("session_status");
  });

  describe("DEFAULT_GATEWAY_HTTP_TOOL_DENY", () => {
    it("contains expected dangerous tools", () => {
      const deny = new Set(DEFAULT_GATEWAY_HTTP_TOOL_DENY);
      expect(deny.has("exec")).toBe(true);
      expect(deny.has("process")).toBe(true);
      expect(deny.has("write")).toBe(true);
      expect(deny.has("edit")).toBe(true);
      expect(deny.has("apply_patch")).toBe(true);
      expect(deny.has("browser")).toBe(true);
      expect(deny.has("sessions_spawn")).toBe(true);
      expect(deny.has("sessions_send")).toBe(true);
      expect(deny.has("gateway")).toBe(true);
    });

    it("does not contain safe tools", () => {
      const deny = new Set(DEFAULT_GATEWAY_HTTP_TOOL_DENY);
      expect(deny.has("read")).toBe(false);
      expect(deny.has("search")).toBe(false);
      expect(deny.has("memory_search")).toBe(false);
      expect(deny.has("session_status")).toBe(false);
    });
  });

  describe("isDangerousHttpTool", () => {
    it("identifies tools on the deny list", () => {
      expect(isDangerousHttpTool("exec")).toBe(true);
      expect(isDangerousHttpTool("browser")).toBe(true);
      expect(isDangerousHttpTool("sessions_spawn")).toBe(true);
    });

    it("normalizes aliases (bash -> exec)", () => {
      expect(isDangerousHttpTool("bash")).toBe(true);
      expect(isDangerousHttpTool("apply-patch")).toBe(true);
    });

    it("returns false for safe tools", () => {
      expect(isDangerousHttpTool("read")).toBe(false);
      expect(isDangerousHttpTool("memory_search")).toBe(false);
      expect(isDangerousHttpTool("message")).toBe(false);
    });
  });

  describe("isReadSearchOnly", () => {
    it("returns true for read and search", () => {
      expect(isReadSearchOnly("read")).toBe(true);
      expect(isReadSearchOnly("search")).toBe(true);
      expect(isReadSearchOnly("READ")).toBe(true);
      expect(isReadSearchOnly("Search")).toBe(true);
    });

    it("returns false for other kinds", () => {
      expect(isReadSearchOnly("edit")).toBe(false);
      expect(isReadSearchOnly("execute")).toBe(false);
      expect(isReadSearchOnly("fetch")).toBe(false);
      expect(isReadSearchOnly("other")).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isReadSearchOnly(undefined)).toBe(false);
      expect(isReadSearchOnly(null)).toBe(false);
    });
  });
});
