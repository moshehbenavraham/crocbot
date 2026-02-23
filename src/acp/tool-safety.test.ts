import { describe, expect, it } from "vitest";

import { classifyToolSafety, inferToolKind, parseToolNameFromTitle } from "./tool-safety.js";

describe("tool-safety", () => {
  describe("inferToolKind", () => {
    it("returns undefined for empty name", () => {
      expect(inferToolKind("")).toBeUndefined();
    });

    it("classifies read tools", () => {
      expect(inferToolKind("read")).toBe("read");
      expect(inferToolKind("file_read")).toBe("read");
      expect(inferToolKind("Read")).toBe("read");
    });

    it("classifies search tools", () => {
      expect(inferToolKind("search")).toBe("search");
      expect(inferToolKind("memory_search")).toBe("search");
      expect(inferToolKind("web-find")).toBe("search");
    });

    it("classifies fetch/http tools", () => {
      expect(inferToolKind("web_fetch")).toBe("fetch");
      expect(inferToolKind("http_get")).toBe("fetch");
    });

    it("classifies edit tools", () => {
      expect(inferToolKind("write")).toBe("edit");
      expect(inferToolKind("file_edit")).toBe("edit");
      expect(inferToolKind("apply_patch")).toBe("edit");
    });

    it("classifies delete tools", () => {
      expect(inferToolKind("delete")).toBe("delete");
      expect(inferToolKind("file_remove")).toBe("delete");
    });

    it("classifies move tools", () => {
      expect(inferToolKind("file_move")).toBe("move");
      expect(inferToolKind("rename")).toBe("move");
    });

    it("classifies execute tools", () => {
      expect(inferToolKind("exec")).toBe("execute");
      expect(inferToolKind("run_command")).toBe("execute");
      expect(inferToolKind("bash")).toBe("execute");
      expect(inferToolKind("process")).toBe("execute");
      expect(inferToolKind("sessions_spawn")).toBe("execute");
    });

    it("returns other for unrecognized tools", () => {
      expect(inferToolKind("message")).toBe("other");
      expect(inferToolKind("cron")).toBe("other");
    });

    it("does not match read as substring (e.g. readme)", () => {
      // "readme" does not have a token boundary match for "read"
      // but it does contain "read" substring. The regex uses boundary matching.
      const kind = inferToolKind("readme");
      // "readme" starts with "read" but has no boundary separator -- regex tests (?:^|[._-])read(?:$|[._-])
      // "readme" would match ^read but then "me" follows without boundary -- so it depends on regex.
      // Actually ^read matches since "read" is at start and the regex is (?:^|[._-])read(?:$|[._-])
      // "readme" = ^read + "me" -- the (?:$|[._-]) fails because "m" follows. So hasToken("read") = false.
      // But normalized === "read" is also false. So it falls through.
      // However, normalized.includes("fetch") etc. are checked later. "readme" has no such match.
      // So it returns "other".
      expect(kind).toBe("other");
    });
  });

  describe("parseToolNameFromTitle", () => {
    it("returns undefined for empty/null input", () => {
      expect(parseToolNameFromTitle(null)).toBeUndefined();
      expect(parseToolNameFromTitle(undefined)).toBeUndefined();
      expect(parseToolNameFromTitle("")).toBeUndefined();
    });

    it("extracts tool name before colon", () => {
      expect(parseToolNameFromTitle("exec: uname -a")).toBe("exec");
      expect(parseToolNameFromTitle("read: src/index.ts")).toBe("read");
    });

    it("falls back to first word when no colon", () => {
      expect(parseToolNameFromTitle("search foo bar")).toBe("search");
    });

    it("ignores multi-word segments before colon", () => {
      expect(parseToolNameFromTitle("file system read: something")).toBe("file");
    });
  });

  describe("classifyToolSafety", () => {
    it("marks dangerous tools as not auto-approvable", () => {
      const result = classifyToolSafety("exec", undefined);
      expect(result.isDangerous).toBe(true);
      expect(result.autoApprove).toBe(false);
    });

    it("marks read tools as auto-approvable", () => {
      const result = classifyToolSafety("read", undefined);
      expect(result.isSafeKind).toBe(true);
      expect(result.isDangerous).toBe(false);
      expect(result.autoApprove).toBe(true);
    });

    it("marks search tools as auto-approvable", () => {
      const result = classifyToolSafety("memory_search", undefined);
      expect(result.isSafeKind).toBe(true);
      expect(result.autoApprove).toBe(true);
    });

    it("prefers explicit kind over inferred", () => {
      // Even though "exec" infers "execute", explicit "read" overrides.
      // But exec is still on the deny list so autoApprove = false.
      const result = classifyToolSafety("exec", "read");
      expect(result.toolKind).toBe("read");
      expect(result.isSafeKind).toBe(true);
      expect(result.isDangerous).toBe(true);
      expect(result.autoApprove).toBe(false);
    });

    it("denies all deny list tools regardless of kind", () => {
      for (const tool of [
        "exec",
        "process",
        "write",
        "edit",
        "apply_patch",
        "browser",
        "sessions_spawn",
        "sessions_send",
        "gateway",
      ]) {
        const result = classifyToolSafety(tool, "read");
        expect(result.isDangerous).toBe(true);
        expect(result.autoApprove).toBe(false);
      }
    });

    it("handles unknown/missing tool name", () => {
      const result = classifyToolSafety(undefined, undefined);
      expect(result.toolName).toBe("");
      expect(result.isDangerous).toBe(true);
      expect(result.autoApprove).toBe(false);
    });

    it("handles null tool name", () => {
      const result = classifyToolSafety(null, null);
      expect(result.toolName).toBe("");
      expect(result.autoApprove).toBe(false);
    });

    it("normalizes tool name aliases", () => {
      const result = classifyToolSafety("bash", undefined);
      expect(result.toolName).toBe("exec");
      expect(result.isDangerous).toBe(true);
    });

    it("non-read/search safe tools are not auto-approved", () => {
      const result = classifyToolSafety("message", undefined);
      expect(result.isDangerous).toBe(false);
      expect(result.isSafeKind).toBe(false);
      expect(result.autoApprove).toBe(false);
    });

    it("web_search is safe and auto-approvable", () => {
      const result = classifyToolSafety("web_search", undefined);
      expect(result.isSafeKind).toBe(true);
      expect(result.isDangerous).toBe(false);
      expect(result.autoApprove).toBe(true);
    });
  });
});
