import { describe, expect, it } from "vitest";

import {
  DEFAULT_GATEWAY_HTTP_TOOL_DENY,
  isDangerousHttpTool,
  isReadSearchOnly,
  normalizeToolName,
} from "../src/agents/tool-policy.js";
import {
  classifyToolSafety,
  inferToolKind,
  parseToolNameFromTitle,
} from "../src/acp/tool-safety.js";

/**
 * Cross-cutting security integration tests for Phase 16.
 *
 * These tests verify that the ACP tool safety classification, gateway HTTP
 * deny list, safe-kind inference, and audit warnings work together as a
 * defense-in-depth system. Each test exercises multiple security layers.
 */
describe("Phase 16 security integration", () => {
  describe("ACP + gateway deny list defense-in-depth", () => {
    it("all gateway deny list tools are classified as dangerous by ACP", () => {
      for (const toolName of DEFAULT_GATEWAY_HTTP_TOOL_DENY) {
        const safety = classifyToolSafety(toolName, undefined);
        expect(safety.isDangerous).toBe(true);
        expect(safety.autoApprove).toBe(false);
      }
    });

    it("gateway deny list tools remain dangerous even with safe explicit kind", () => {
      for (const toolName of DEFAULT_GATEWAY_HTTP_TOOL_DENY) {
        const safety = classifyToolSafety(toolName, "read");
        expect(safety.isDangerous).toBe(true);
        expect(safety.autoApprove).toBe(false);
      }
    });

    it("safe tools pass both ACP and gateway checks", () => {
      const safeTools = ["read", "memory_search", "web_search", "session_status"];
      for (const toolName of safeTools) {
        expect(isDangerousHttpTool(toolName)).toBe(false);
        const safety = classifyToolSafety(toolName, undefined);
        expect(safety.isDangerous).toBe(false);
      }
    });
  });

  describe("safe-kind inference + deny list interaction", () => {
    it("tool name aliases are resolved consistently across layers", () => {
      // "bash" is an alias for "exec" -- both layers must agree
      expect(normalizeToolName("bash")).toBe("exec");
      expect(isDangerousHttpTool("bash")).toBe(true);
      const safety = classifyToolSafety("bash", undefined);
      expect(safety.toolName).toBe("exec");
      expect(safety.isDangerous).toBe(true);
    });

    it("apply-patch alias resolves to apply_patch on deny list", () => {
      expect(normalizeToolName("apply-patch")).toBe("apply_patch");
      expect(isDangerousHttpTool("apply-patch")).toBe(true);
      const safety = classifyToolSafety("apply-patch", undefined);
      expect(safety.toolName).toBe("apply_patch");
      expect(safety.isDangerous).toBe(true);
    });

    it("inferred kind of read tools aligns with isReadSearchOnly", () => {
      const kind = inferToolKind("read");
      expect(kind).toBe("read");
      expect(isReadSearchOnly(kind)).toBe(true);
    });

    it("inferred kind of exec tools is never read/search", () => {
      const execTools = ["exec", "bash", "process", "sessions_spawn"];
      for (const tool of execTools) {
        const kind = inferToolKind(normalizeToolName(tool));
        expect(isReadSearchOnly(kind)).toBe(false);
      }
    });

    it("inferred kind of edit tools is never read/search", () => {
      const editTools = ["write", "edit", "apply_patch"];
      for (const tool of editTools) {
        const kind = inferToolKind(tool);
        expect(kind).toBe("edit");
        expect(isReadSearchOnly(kind)).toBe(false);
      }
    });
  });

  describe("title parsing + safety classification pipeline", () => {
    it("title-based tool classification matches direct classification", () => {
      const testCases = [
        { title: "read: src/index.ts", expected: "read" },
        { title: "exec: uname -a", expected: "exec" },
        { title: "write: /tmp/file", expected: "write" },
        { title: "search: query", expected: "search" },
      ];
      for (const tc of testCases) {
        const nameFromTitle = parseToolNameFromTitle(tc.title);
        expect(nameFromTitle).toBe(tc.expected);
        const fromTitle = classifyToolSafety(nameFromTitle ?? "", undefined);
        const direct = classifyToolSafety(tc.expected, undefined);
        expect(fromTitle.isDangerous).toBe(direct.isDangerous);
        expect(fromTitle.autoApprove).toBe(direct.autoApprove);
      }
    });
  });

  describe("defense-in-depth: no single bypass", () => {
    it("dangerous tools blocked at all three layers", () => {
      // Layer 1: Gateway HTTP deny list
      // Layer 2: ACP safety classification (isDangerous)
      // Layer 3: Safe-kind inference (not read/search)
      for (const tool of ["exec", "process", "write", "edit", "apply_patch", "browser"]) {
        // Layer 1
        expect(isDangerousHttpTool(tool)).toBe(true);
        // Layer 2+3
        const safety = classifyToolSafety(tool, undefined);
        expect(safety.isDangerous).toBe(true);
        expect(safety.isSafeKind).toBe(false);
        expect(safety.autoApprove).toBe(false);
      }
    });

    it("non-dangerous non-safe tools are still denied by ACP", () => {
      // Tools like "message", "cron" are not on deny list but are not read/search
      const tools = ["message", "cron", "image"];
      for (const tool of tools) {
        const safety = classifyToolSafety(tool, undefined);
        expect(safety.isDangerous).toBe(false);
        expect(safety.isSafeKind).toBe(false);
        expect(safety.autoApprove).toBe(false);
      }
    });

    it("only read/search tools with no deny list match get auto-approved", () => {
      const autoApproved = ["read", "memory_search", "web_search"];
      for (const tool of autoApproved) {
        const safety = classifyToolSafety(tool, undefined);
        expect(safety.isDangerous).toBe(false);
        expect(safety.isSafeKind).toBe(true);
        expect(safety.autoApprove).toBe(true);
      }
    });
  });

  describe("edge cases across security layers", () => {
    it("empty tool name is treated as dangerous", () => {
      const safety = classifyToolSafety("", undefined);
      expect(safety.isDangerous).toBe(true);
      expect(safety.autoApprove).toBe(false);
    });

    it("undefined tool name is treated as dangerous", () => {
      const safety = classifyToolSafety(undefined, undefined);
      expect(safety.isDangerous).toBe(true);
      expect(safety.autoApprove).toBe(false);
    });

    it("whitespace-only tool name is treated as dangerous", () => {
      const safety = classifyToolSafety("  ", undefined);
      expect(safety.isDangerous).toBe(true);
      expect(safety.autoApprove).toBe(false);
    });

    it("unknown explicit kind does not grant auto-approve", () => {
      const safety = classifyToolSafety("unknown_tool", "custom_kind");
      expect(safety.isSafeKind).toBe(false);
      expect(safety.autoApprove).toBe(false);
    });
  });
});
