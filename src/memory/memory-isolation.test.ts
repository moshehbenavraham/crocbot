/**
 * Integration test: cross-project memory isolation.
 *
 * Verifies that the memory subsystem produces fully isolated paths
 * for different projects: separate SQLite databases, separate session
 * directories, and separate workspace directories. Also verifies that
 * the default project paths match pre-Phase 14 behavior.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveMemorySearchConfig } from "../agents/memory-search.js";
import { isDefaultProject } from "../agents/project-scope.js";
import {
  resolveProjectSessionsDir,
  resolveSessionTranscriptPath,
  resolveSessionTranscriptsDirForAgent,
} from "../config/sessions/paths.js";

const FAKE_HOME = "/fakehome";
// path.resolve ensures the expected value matches the resolved path on all
// platforms (on Windows, path.resolve("/fakehome") prepends the drive letter).
const RESOLVED_HOME = path.resolve(FAKE_HOME);
const fakeHomedir = () => FAKE_HOME;

const minimalCfg = {
  agents: {
    defaults: {
      memorySearch: { enabled: true },
    },
  },
};

describe("cross-project memory isolation", () => {
  describe("store path isolation", () => {
    it("produces different SQLite paths for different projects", () => {
      const pathA = resolveMemorySearchConfig(minimalCfg, "main", "project-a");
      const pathB = resolveMemorySearchConfig(minimalCfg, "main", "project-b");

      expect(pathA).not.toBeNull();
      expect(pathB).not.toBeNull();
      expect(pathA!.store.path).not.toBe(pathB!.store.path);
      expect(pathA!.store.path).toContain("project-a");
      expect(pathB!.store.path).toContain("project-b");
    });

    it("default project path matches pre-Phase 14 agent-level path", () => {
      const defaultPath = resolveMemorySearchConfig(minimalCfg, "main");
      const explicitDefault = resolveMemorySearchConfig(minimalCfg, "main", "default");
      const nullDefault = resolveMemorySearchConfig(minimalCfg, "main", null);

      expect(defaultPath!.store.path).toBe(explicitDefault!.store.path);
      expect(defaultPath!.store.path).toBe(nullDefault!.store.path);
      expect(defaultPath!.store.path).toMatch(/main\.sqlite$/);
      expect(defaultPath!.store.path).not.toContain("default.");
    });

    it("project store path includes agentId and projectId", () => {
      const config = resolveMemorySearchConfig(minimalCfg, "main", "my-project");
      expect(config!.store.path).toMatch(/main\.my-project\.sqlite$/);
    });
  });

  describe("session directory isolation", () => {
    it("produces different session directories for different projects", () => {
      const dirA = resolveProjectSessionsDir("main", "project-a", {}, fakeHomedir);
      const dirB = resolveProjectSessionsDir("main", "project-b", {}, fakeHomedir);

      expect(dirA).not.toBe(dirB);
      expect(dirA).toContain("project-a");
      expect(dirB).toContain("project-b");
    });

    it("default project session dir matches agent-level dir", () => {
      const defaultDir = resolveProjectSessionsDir("main", undefined, {}, fakeHomedir);
      const agentDir = resolveSessionTranscriptsDirForAgent("main", {}, fakeHomedir);

      expect(defaultDir).toBe(agentDir);
    });

    it("project session dir uses projects/{projectId}/sessions/ structure", () => {
      const dir = resolveProjectSessionsDir("main", "my-project", {}, fakeHomedir);
      const expected = path.join(
        RESOLVED_HOME,
        ".crocbot",
        "agents",
        "main",
        "projects",
        "my-project",
        "sessions",
      );
      expect(dir).toBe(expected);
    });
  });

  describe("session transcript path isolation", () => {
    it("produces different transcript paths for different projects", () => {
      const pathA = resolveSessionTranscriptPath("sess-001", "main", undefined, "project-a");
      const pathB = resolveSessionTranscriptPath("sess-001", "main", undefined, "project-b");

      expect(pathA).not.toBe(pathB);
      expect(pathA).toContain("project-a");
      expect(pathB).toContain("project-b");
    });

    it("default project transcript path matches pre-Phase 14 path", () => {
      const defaultPath = resolveSessionTranscriptPath("sess-001", "main");
      const explicitDefault = resolveSessionTranscriptPath(
        "sess-001",
        "main",
        undefined,
        "default",
      );

      expect(defaultPath).toBe(explicitDefault);
    });
  });

  describe("isDefaultProject predicate", () => {
    it("returns true for undefined", () => {
      expect(isDefaultProject(undefined)).toBe(true);
    });

    it("returns true for null", () => {
      expect(isDefaultProject(null)).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(isDefaultProject("")).toBe(true);
    });

    it("returns true for 'default'", () => {
      expect(isDefaultProject("default")).toBe(true);
    });

    it("returns true for 'Default' (case-insensitive)", () => {
      expect(isDefaultProject("Default")).toBe(true);
    });

    it("returns false for named project", () => {
      expect(isDefaultProject("my-project")).toBe(false);
    });
  });

  describe("backward compatibility", () => {
    it("resolveMemorySearchConfig without projectId produces same result as before", () => {
      const withoutProject = resolveMemorySearchConfig(minimalCfg, "main");
      const withUndefined = resolveMemorySearchConfig(minimalCfg, "main", undefined);

      expect(withoutProject).toEqual(withUndefined);
    });

    it("resolveSessionTranscriptsDirForAgent without projectId matches original", () => {
      const original = resolveSessionTranscriptsDirForAgent("main", {}, fakeHomedir);
      const withUndefined = resolveSessionTranscriptsDirForAgent(
        "main",
        {},
        fakeHomedir,
        undefined,
      );

      expect(original).toBe(withUndefined);
    });
  });
});
