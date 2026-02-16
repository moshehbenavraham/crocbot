import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_PROJECT_ID } from "../config/types.projects.js";

import {
  ensureProjectWorkspace,
  isDefaultProject,
  normalizeProjectId,
  readProjectMetadata,
  resolveProjectContext,
  resolveProjectDir,
  resolveProjectPaths,
  resolveProjectWorkspaceDir,
  validateProjectConfig,
  writeProjectMetadata,
} from "./project-scope.js";

// -- Helpers --

function makeCfg(overrides?: Record<string, unknown>): Record<string, unknown> {
  return { ...overrides };
}

// -- normalizeProjectId --

describe("normalizeProjectId", () => {
  it("returns 'default' for undefined", () => {
    expect(normalizeProjectId(undefined)).toBe(DEFAULT_PROJECT_ID);
  });

  it("returns 'default' for null", () => {
    expect(normalizeProjectId(null)).toBe(DEFAULT_PROJECT_ID);
  });

  it("returns 'default' for empty string", () => {
    expect(normalizeProjectId("")).toBe(DEFAULT_PROJECT_ID);
  });

  it("returns 'default' for whitespace-only", () => {
    expect(normalizeProjectId("   ")).toBe(DEFAULT_PROJECT_ID);
  });

  it("returns 'default' for the literal 'default'", () => {
    expect(normalizeProjectId("default")).toBe(DEFAULT_PROJECT_ID);
  });

  it("normalizes 'Default' to 'default' (case-insensitive)", () => {
    expect(normalizeProjectId("Default")).toBe(DEFAULT_PROJECT_ID);
  });

  it("normalizes 'My-App' to 'my-app'", () => {
    expect(normalizeProjectId("My-App")).toBe("my-app");
  });

  it("keeps valid kebab-case unchanged", () => {
    expect(normalizeProjectId("my-cool-project")).toBe("my-cool-project");
  });

  it("allows project IDs starting with a digit", () => {
    expect(normalizeProjectId("1project")).toBe("1project");
  });

  it("allows consecutive hyphens", () => {
    expect(normalizeProjectId("my--project")).toBe("my--project");
  });

  it("normalizes invalid characters to hyphens", () => {
    expect(normalizeProjectId("My App!")).toBe("my-app");
  });

  it("truncates at 64 characters", () => {
    const longId = "a".repeat(65);
    const result = normalizeProjectId(longId);
    expect(result.length).toBeLessThanOrEqual(64);
  });

  it("accepts exactly 64 characters", () => {
    const id64 = "a".repeat(64);
    expect(normalizeProjectId(id64)).toBe(id64);
  });

  it("throws on path traversal with ../", () => {
    expect(() => normalizeProjectId("../etc")).toThrow("path traversal");
  });

  it("throws on path traversal with ..\\", () => {
    expect(() => normalizeProjectId("..\\etc")).toThrow("path traversal");
  });

  it("throws on embedded path traversal", () => {
    expect(() => normalizeProjectId("foo/../bar")).toThrow("path traversal");
  });

  it("rejects Unicode characters via normalization", () => {
    // Unicode chars are stripped by the invalid chars regex
    const result = normalizeProjectId("\u00e9app");
    expect(result).toBe("app");
  });
});

// -- isDefaultProject --

describe("isDefaultProject", () => {
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

  it("returns false for 'myapp'", () => {
    expect(isDefaultProject("myapp")).toBe(false);
  });

  it("returns false for 'my-project'", () => {
    expect(isDefaultProject("my-project")).toBe(false);
  });
});

// -- validateProjectConfig --

describe("validateProjectConfig", () => {
  it("returns empty array for undefined", () => {
    expect(validateProjectConfig(undefined)).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(validateProjectConfig(null)).toEqual([]);
  });

  it("returns empty array for empty list", () => {
    expect(validateProjectConfig([])).toEqual([]);
  });

  it("passes for valid unique project IDs", () => {
    const errors = validateProjectConfig([{ id: "project-a" }, { id: "project-b" }]);
    expect(errors).toEqual([]);
  });

  it("rejects duplicate project IDs", () => {
    const errors = validateProjectConfig([{ id: "my-project" }, { id: "my-project" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Duplicate");
  });

  it("rejects duplicate IDs after normalization", () => {
    const errors = validateProjectConfig([{ id: "My-Project" }, { id: "my-project" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Duplicate");
  });

  it("rejects path traversal in project IDs", () => {
    const errors = validateProjectConfig([{ id: "../escape" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("traversal");
  });

  it("rejects the reserved 'default' project ID", () => {
    const errors = validateProjectConfig([{ id: "default" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("reserved");
  });

  it("reports multiple errors", () => {
    const errors = validateProjectConfig([
      { id: "default" },
      { id: "../hack" },
      { id: "valid-project" },
      { id: "valid-project" },
    ]);
    expect(errors).toHaveLength(3);
  });
});

// -- resolveProjectDir --

describe("resolveProjectDir", () => {
  it("returns correct path for a named project", () => {
    const cfg = makeCfg();
    const result = resolveProjectDir(cfg, "main", "myapp");
    expect(result).toContain(path.join("agents", "main", "projects", "myapp"));
  });

  it("normalizes agent ID and project ID", () => {
    const cfg = makeCfg();
    const result = resolveProjectDir(cfg, "Main", "My-App");
    expect(result).toContain(path.join("agents", "main", "projects", "my-app"));
  });

  it("throws for default project ID", () => {
    const cfg = makeCfg();
    expect(() => resolveProjectDir(cfg, "main", "default")).toThrow(
      "must not be called with the default project ID",
    );
  });
});

// -- resolveProjectWorkspaceDir --

describe("resolveProjectWorkspaceDir", () => {
  it("delegates to resolveAgentWorkspaceDir for undefined project", () => {
    const cfg = makeCfg();
    const agentWorkspace = resolveProjectWorkspaceDir(cfg, "main", undefined);
    // For default project, should NOT contain "projects" in path
    expect(agentWorkspace).not.toContain("projects");
  });

  it("delegates to resolveAgentWorkspaceDir for null project", () => {
    const cfg = makeCfg();
    const agentWorkspace = resolveProjectWorkspaceDir(cfg, "main", null);
    expect(agentWorkspace).not.toContain("projects");
  });

  it("delegates to resolveAgentWorkspaceDir for 'default' project", () => {
    const cfg = makeCfg();
    const agentWorkspace = resolveProjectWorkspaceDir(cfg, "main", "default");
    expect(agentWorkspace).not.toContain("projects");
  });

  it("returns exact same string as resolveAgentWorkspaceDir for default project", () => {
    const cfg = makeCfg();
    const viaProject = resolveProjectWorkspaceDir(cfg, "main", undefined);
    const viaProjectDefault = resolveProjectWorkspaceDir(cfg, "main", "default");
    // Both should be identical strings
    expect(viaProject).toBe(viaProjectDefault);
  });

  it("returns project workspace path for named project", () => {
    const cfg = makeCfg();
    const result = resolveProjectWorkspaceDir(cfg, "main", "myapp");
    expect(result).toContain(path.join("projects", "myapp", "workspace"));
  });
});

// -- resolveProjectPaths --

describe("resolveProjectPaths", () => {
  it("returns all 6 path fields for a named project", () => {
    const cfg = makeCfg();
    const paths = resolveProjectPaths(cfg, "main", "myapp");

    expect(paths.projectDir).toContain(path.join("projects", "myapp"));
    expect(paths.workspaceDir).toContain(path.join("myapp", "workspace"));
    expect(paths.memoryDir).toContain(path.join("myapp", "memory"));
    expect(paths.settingsDir).toContain(path.join("myapp", "settings"));
    expect(paths.logsDir).toContain(path.join("myapp", "logs"));
    expect(paths.metadataPath).toContain(path.join("myapp", "project.json"));
  });

  it("throws for default project ID", () => {
    const cfg = makeCfg();
    expect(() => resolveProjectPaths(cfg, "main", "default")).toThrow(
      "must not be called with the default project ID",
    );
  });

  it("paths are consistent with resolveProjectDir", () => {
    const cfg = makeCfg();
    const dir = resolveProjectDir(cfg, "main", "myapp");
    const paths = resolveProjectPaths(cfg, "main", "myapp");
    expect(paths.projectDir).toBe(dir);
    expect(paths.workspaceDir).toBe(path.join(dir, "workspace"));
  });
});

// -- resolveProjectContext --

describe("resolveProjectContext", () => {
  it("returns isDefault: true for undefined project", async () => {
    const cfg = makeCfg();
    const ctx = await resolveProjectContext(cfg, "main", undefined);

    expect(ctx.projectId).toBe(DEFAULT_PROJECT_ID);
    expect(ctx.isDefault).toBe(true);
    expect(ctx.paths).toBeUndefined();
    expect(ctx.metadata).toBeUndefined();
    expect(ctx.workspaceDir).toBeTruthy();
    expect(ctx.workspaceDir).not.toContain("projects");
  });

  it("returns isDefault: true for 'default' project", async () => {
    const cfg = makeCfg();
    const ctx = await resolveProjectContext(cfg, "main", "default");

    expect(ctx.isDefault).toBe(true);
    expect(ctx.paths).toBeUndefined();
  });

  it("returns isDefault: false for named project", async () => {
    const cfg = makeCfg();
    const ctx = await resolveProjectContext(cfg, "main", "myapp");

    expect(ctx.projectId).toBe("myapp");
    expect(ctx.isDefault).toBe(false);
    expect(ctx.paths).toBeDefined();
    expect(ctx.paths?.projectDir).toContain(path.join("projects", "myapp"));
    expect(ctx.workspaceDir).toContain(path.join("myapp", "workspace"));
    // Metadata will be undefined since no file exists
    expect(ctx.metadata).toBeUndefined();
  });
});

// -- readProjectMetadata & writeProjectMetadata --

describe("readProjectMetadata / writeProjectMetadata", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-project-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns undefined for missing file", async () => {
    const result = await readProjectMetadata(path.join(tmpDir, "nonexistent.json"));
    expect(result).toBeUndefined();
  });

  it("returns undefined for invalid JSON", async () => {
    const metaPath = path.join(tmpDir, "project.json");
    await fs.writeFile(metaPath, "not json", "utf-8");
    const result = await readProjectMetadata(metaPath);
    expect(result).toBeUndefined();
  });

  it("returns undefined for missing required fields", async () => {
    const metaPath = path.join(tmpDir, "project.json");
    await fs.writeFile(metaPath, JSON.stringify({ foo: "bar" }), "utf-8");
    const result = await readProjectMetadata(metaPath);
    expect(result).toBeUndefined();
  });

  it("round-trips metadata correctly", async () => {
    const metaPath = path.join(tmpDir, "project.json");
    const metadata = {
      projectId: "myapp",
      createdAt: "2026-02-16T10:00:00.000Z",
      lastAccessedAt: "2026-02-16T11:00:00.000Z",
      schemaVersion: 1,
    };

    await writeProjectMetadata(metaPath, metadata);
    const result = await readProjectMetadata(metaPath);

    expect(result).toEqual(metadata);
  });

  it("creates parent directories for writeProjectMetadata", async () => {
    const metaPath = path.join(tmpDir, "deep", "nested", "project.json");
    const metadata = {
      projectId: "myapp",
      createdAt: "2026-02-16T10:00:00.000Z",
      lastAccessedAt: "2026-02-16T10:00:00.000Z",
      schemaVersion: 1,
    };

    await writeProjectMetadata(metaPath, metadata);
    const result = await readProjectMetadata(metaPath);
    expect(result).toEqual(metadata);
  });

  it("defaults lastAccessedAt to createdAt when missing", async () => {
    const metaPath = path.join(tmpDir, "project.json");
    await fs.writeFile(
      metaPath,
      JSON.stringify({
        projectId: "myapp",
        createdAt: "2026-02-16T10:00:00.000Z",
      }),
      "utf-8",
    );
    const result = await readProjectMetadata(metaPath);
    expect(result?.lastAccessedAt).toBe("2026-02-16T10:00:00.000Z");
  });

  it("defaults schemaVersion to 1 when missing", async () => {
    const metaPath = path.join(tmpDir, "project.json");
    await fs.writeFile(
      metaPath,
      JSON.stringify({
        projectId: "myapp",
        createdAt: "2026-02-16T10:00:00.000Z",
        lastAccessedAt: "2026-02-16T10:00:00.000Z",
      }),
      "utf-8",
    );
    const result = await readProjectMetadata(metaPath);
    expect(result?.schemaVersion).toBe(1);
  });
});

// -- ensureProjectWorkspace --

describe("ensureProjectWorkspace", () => {
  let tmpDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-project-ws-"));
    originalEnv = process.env.CROCBOT_STATE_DIR;
    process.env.CROCBOT_STATE_DIR = tmpDir;
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.CROCBOT_STATE_DIR;
    } else {
      process.env.CROCBOT_STATE_DIR = originalEnv;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates the project directory tree", async () => {
    const cfg = makeCfg();
    const paths = await ensureProjectWorkspace(cfg, "main", "myapp");

    // Verify directories exist
    const wsStats = await fs.stat(paths.workspaceDir);
    expect(wsStats.isDirectory()).toBe(true);

    const memStats = await fs.stat(paths.memoryDir);
    expect(memStats.isDirectory()).toBe(true);

    const settingsStats = await fs.stat(paths.settingsDir);
    expect(settingsStats.isDirectory()).toBe(true);

    const logsStats = await fs.stat(paths.logsDir);
    expect(logsStats.isDirectory()).toBe(true);
  });

  it("writes MEMORY.md in workspace directory", async () => {
    const cfg = makeCfg();
    const paths = await ensureProjectWorkspace(cfg, "main", "myapp");

    const memoryMd = await fs.readFile(path.join(paths.workspaceDir, "MEMORY.md"), "utf-8");
    expect(memoryMd).toBe("# Memory\n");
  });

  it("writes project metadata", async () => {
    const cfg = makeCfg();
    const paths = await ensureProjectWorkspace(cfg, "main", "myapp");

    const metadata = await readProjectMetadata(paths.metadataPath);
    expect(metadata).toBeDefined();
    expect(metadata?.projectId).toBe("myapp");
    expect(metadata?.schemaVersion).toBe(1);
    expect(metadata?.createdAt).toBeTruthy();
  });

  it("is idempotent on re-run", async () => {
    const cfg = makeCfg();

    // First run
    const paths1 = await ensureProjectWorkspace(cfg, "main", "myapp");
    const meta1 = await readProjectMetadata(paths1.metadataPath);

    // Second run
    const paths2 = await ensureProjectWorkspace(cfg, "main", "myapp");
    const meta2 = await readProjectMetadata(paths2.metadataPath);

    // Paths should be identical
    expect(paths1.projectDir).toBe(paths2.projectDir);

    // Metadata should be preserved (not overwritten)
    expect(meta1?.createdAt).toBe(meta2?.createdAt);
  });

  it("does not overwrite existing MEMORY.md", async () => {
    const cfg = makeCfg();

    // First run creates MEMORY.md
    const paths = await ensureProjectWorkspace(cfg, "main", "myapp");
    const memoryPath = path.join(paths.workspaceDir, "MEMORY.md");

    // Modify MEMORY.md
    await fs.writeFile(memoryPath, "# Custom Memory\n", "utf-8");

    // Second run should not overwrite
    await ensureProjectWorkspace(cfg, "main", "myapp");
    const content = await fs.readFile(memoryPath, "utf-8");
    expect(content).toBe("# Custom Memory\n");
  });
});
