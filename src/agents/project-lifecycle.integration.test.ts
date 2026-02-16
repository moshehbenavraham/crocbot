import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureProjectWorkspace,
  isDefaultProject,
  normalizeProjectId,
  readProjectMetadata,
  resolveProjectContext,
  resolveProjectWorkspaceDir,
  validateProjectConfig,
} from "./project-scope.js";
import type { ProjectConfig } from "../config/types.projects.js";
import { DEFAULT_PROJECT_ID } from "../config/types.projects.js";
import {
  buildProjectAwareSessionKey,
  extractProjectFromSessionKey,
  stripProjectFromSessionKey,
} from "../routing/session-key.js";

/* ------------------------------------------------------------------ */
/* Temp directory helpers                                              */
/* ------------------------------------------------------------------ */

let tmpDir: string;
let stateDir: string;
let workspaceDir: string;

function makeCfg(agentId = "main") {
  // Minimal config shape that satisfies resolveAgentDir/resolveAgentWorkspaceDir
  return {
    agents: {
      defaults: {},
      list: [{ id: agentId }],
    },
    stateDir,
    workspaceDir,
  } as never;
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-test-"));
  stateDir = path.join(tmpDir, "state");
  workspaceDir = path.join(tmpDir, "workspace");
  await fs.mkdir(stateDir, { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });
});

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ */
/* T008 - Scaffolding: project-scope helpers work with real filesystem */
/* ------------------------------------------------------------------ */

describe("project-scope filesystem integration", () => {
  it("normalizeProjectId returns default for empty input", () => {
    expect(normalizeProjectId("")).toBe(DEFAULT_PROJECT_ID);
    expect(normalizeProjectId(null)).toBe(DEFAULT_PROJECT_ID);
    expect(normalizeProjectId(undefined)).toBe(DEFAULT_PROJECT_ID);
  });

  it("normalizeProjectId lowercases and validates", () => {
    expect(normalizeProjectId("MyApp")).toBe("myapp");
    expect(normalizeProjectId("my-app-2")).toBe("my-app-2");
  });

  it("isDefaultProject correctly identifies default", () => {
    expect(isDefaultProject("default")).toBe(true);
    expect(isDefaultProject("")).toBe(true);
    expect(isDefaultProject(null)).toBe(true);
    expect(isDefaultProject("myapp")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* T009 - End-to-end project lifecycle                                */
/* ------------------------------------------------------------------ */

describe("end-to-end project lifecycle", () => {
  // We mock resolveAgentDir to return our temp directory structure
  vi.mock("./agent-scope.js", () => ({
    resolveAgentDir: (_cfg: never, agentId: string) => {
      // resolveProjectDir goes up one directory from agentDir
      return path.join(stateDir, "agents", agentId, "agent");
    },
    resolveAgentWorkspaceDir: (_cfg: never, _agentId: string) => {
      return workspaceDir;
    },
  }));

  it("creates project, verifies paths, reads metadata", async () => {
    const cfg = makeCfg("main");
    const projectId = "webapp";

    // Create project workspace
    const paths = await ensureProjectWorkspace(cfg, "main", projectId);

    // Verify directories exist
    const wsStats = await fs.stat(paths.workspaceDir);
    expect(wsStats.isDirectory()).toBe(true);

    const memStats = await fs.stat(paths.memoryDir);
    expect(memStats.isDirectory()).toBe(true);

    // Verify metadata was written
    const metadata = await readProjectMetadata(paths.metadataPath);
    expect(metadata).toBeDefined();
    expect(metadata?.projectId).toBe("webapp");
    expect(metadata?.schemaVersion).toBe(1);
    expect(metadata?.createdAt).toBeDefined();

    // Verify MEMORY.md exists
    const memoryMd = await fs.readFile(path.join(paths.workspaceDir, "MEMORY.md"), "utf-8");
    expect(memoryMd).toBe("# Memory\n");
  });

  it("ensureProjectWorkspace is idempotent", async () => {
    const cfg = makeCfg("main");
    const projectId = "myapp";

    const paths1 = await ensureProjectWorkspace(cfg, "main", projectId);
    const meta1 = await readProjectMetadata(paths1.metadataPath);

    // Call again -- should not overwrite metadata
    const paths2 = await ensureProjectWorkspace(cfg, "main", projectId);
    const meta2 = await readProjectMetadata(paths2.metadataPath);

    expect(paths1.projectDir).toBe(paths2.projectDir);
    expect(meta1?.createdAt).toBe(meta2?.createdAt);
  });

  it("resolveProjectContext returns default context for default project", async () => {
    const cfg = makeCfg("main");
    const ctx = await resolveProjectContext(cfg, "main", "default");

    expect(ctx.isDefault).toBe(true);
    expect(ctx.projectId).toBe(DEFAULT_PROJECT_ID);
    expect(ctx.paths).toBeUndefined();
    expect(ctx.workspaceDir).toBe(workspaceDir);
  });

  it("resolveProjectContext returns named project context", async () => {
    const cfg = makeCfg("main");
    await ensureProjectWorkspace(cfg, "main", "analytics");

    const ctx = await resolveProjectContext(cfg, "main", "analytics");

    expect(ctx.isDefault).toBe(false);
    expect(ctx.projectId).toBe("analytics");
    expect(ctx.paths).toBeDefined();
    expect(ctx.metadata).toBeDefined();
    expect(ctx.metadata?.projectId).toBe("analytics");
  });

  it("resolveProjectWorkspaceDir delegates to agent workspace for default", () => {
    const cfg = makeCfg("main");
    const dir = resolveProjectWorkspaceDir(cfg, "main", "default");
    expect(dir).toBe(workspaceDir);
  });

  it("resolveProjectWorkspaceDir returns project workspace for named project", () => {
    const cfg = makeCfg("main");
    const dir = resolveProjectWorkspaceDir(cfg, "main", "myapp");
    expect(dir).toContain("projects");
    expect(dir).toContain("myapp");
    expect(dir).toMatch(/workspace$/);
  });
});

/* ------------------------------------------------------------------ */
/* T010 - Multi-project path isolation                                */
/* ------------------------------------------------------------------ */

describe("multi-project path isolation", () => {
  vi.mock("./agent-scope.js", () => ({
    resolveAgentDir: (_cfg: never, agentId: string) => {
      return path.join(stateDir, "agents", agentId, "agent");
    },
    resolveAgentWorkspaceDir: (_cfg: never, _agentId: string) => {
      return workspaceDir;
    },
  }));

  it("creates isolated directories for different projects", async () => {
    const cfg = makeCfg("main");

    const pathsA = await ensureProjectWorkspace(cfg, "main", "project-a");
    const pathsB = await ensureProjectWorkspace(cfg, "main", "project-b");

    // Directories must be distinct
    expect(pathsA.projectDir).not.toBe(pathsB.projectDir);
    expect(pathsA.workspaceDir).not.toBe(pathsB.workspaceDir);
    expect(pathsA.memoryDir).not.toBe(pathsB.memoryDir);

    // Write a file in project A's workspace
    await fs.writeFile(path.join(pathsA.workspaceDir, "test.txt"), "project-a-data", "utf-8");

    // Verify file does not exist in project B's workspace
    const filesB = await fs.readdir(pathsB.workspaceDir);
    expect(filesB).not.toContain("test.txt");

    // Verify file exists in project A's workspace
    const filesA = await fs.readdir(pathsA.workspaceDir);
    expect(filesA).toContain("test.txt");
  });

  it("session keys isolate project context", () => {
    const base = "agent:main:telegram:group:123";

    const keyA = buildProjectAwareSessionKey({ baseSessionKey: base, projectId: "project-a" });
    const keyB = buildProjectAwareSessionKey({ baseSessionKey: base, projectId: "project-b" });

    // Keys are distinct
    expect(keyA).not.toBe(keyB);

    // Extract returns correct project
    expect(extractProjectFromSessionKey(keyA)).toBe("project-a");
    expect(extractProjectFromSessionKey(keyB)).toBe("project-b");

    // Strip returns the same base
    expect(stripProjectFromSessionKey(keyA)).toBe(base);
    expect(stripProjectFromSessionKey(keyB)).toBe(base);
  });

  it("default project uses agent workspace, not project directory", async () => {
    const cfg = makeCfg("main");

    const defaultCtx = await resolveProjectContext(cfg, "main", "default");
    const namedPaths = await ensureProjectWorkspace(cfg, "main", "myapp");
    const namedCtx = await resolveProjectContext(cfg, "main", "myapp");

    // Default workspace is the agent workspace
    expect(defaultCtx.workspaceDir).toBe(workspaceDir);
    // Named project workspace is inside the project directory
    expect(namedCtx.workspaceDir).toBe(namedPaths.workspaceDir);
    // They must be different
    expect(defaultCtx.workspaceDir).not.toBe(namedCtx.workspaceDir);
  });
});

/* ------------------------------------------------------------------ */
/* T011 - Gateway-style lifecycle sequence (unit-level integration)   */
/* ------------------------------------------------------------------ */

describe("project CRUD lifecycle sequence", () => {
  vi.mock("./agent-scope.js", () => ({
    resolveAgentDir: (_cfg: never, agentId: string) => {
      return path.join(stateDir, "agents", agentId, "agent");
    },
    resolveAgentWorkspaceDir: (_cfg: never, _agentId: string) => {
      return workspaceDir;
    },
  }));

  it("create -> list -> switch context -> delete lifecycle", async () => {
    const cfg = makeCfg("main");

    // 1. Create two projects
    const pathsAlpha = await ensureProjectWorkspace(cfg, "main", "alpha");
    const pathsBeta = await ensureProjectWorkspace(cfg, "main", "beta");

    // 2. Verify both have metadata
    const metaAlpha = await readProjectMetadata(pathsAlpha.metadataPath);
    const metaBeta = await readProjectMetadata(pathsBeta.metadataPath);
    expect(metaAlpha?.projectId).toBe("alpha");
    expect(metaBeta?.projectId).toBe("beta");

    // 3. Simulate "switch" by resolving project context
    const ctxAlpha = await resolveProjectContext(cfg, "main", "alpha");
    expect(ctxAlpha.isDefault).toBe(false);
    expect(ctxAlpha.projectId).toBe("alpha");

    const ctxBeta = await resolveProjectContext(cfg, "main", "beta");
    expect(ctxBeta.isDefault).toBe(false);
    expect(ctxBeta.projectId).toBe("beta");

    // 4. Verify workspaces are isolated
    expect(ctxAlpha.workspaceDir).not.toBe(ctxBeta.workspaceDir);

    // 5. Simulate "delete" by removing directory
    await fs.rm(pathsAlpha.projectDir, { recursive: true, force: true });
    const exists = await fs.access(pathsAlpha.projectDir).then(
      () => true,
      () => false,
    );
    expect(exists).toBe(false);

    // 6. Beta still exists
    const betaExists = await fs.access(pathsBeta.projectDir).then(
      () => true,
      () => false,
    );
    expect(betaExists).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* validateProjectConfig integration                                  */
/* ------------------------------------------------------------------ */

describe("validateProjectConfig", () => {
  it("returns no errors for valid config", () => {
    const projects: ProjectConfig[] = [{ id: "webapp" }, { id: "mobile-app", name: "Mobile App" }];
    expect(validateProjectConfig(projects)).toEqual([]);
  });

  it("returns no errors for empty/null config", () => {
    expect(validateProjectConfig([])).toEqual([]);
    expect(validateProjectConfig(null)).toEqual([]);
    expect(validateProjectConfig(undefined)).toEqual([]);
  });

  it("detects duplicate project IDs", () => {
    const projects: ProjectConfig[] = [
      { id: "webapp" },
      { id: "WebApp" }, // normalizes to same as "webapp"
    ];
    const errors = validateProjectConfig(projects);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("Duplicate");
  });

  it("rejects reserved default ID", () => {
    const projects: ProjectConfig[] = [{ id: "default" }];
    const errors = validateProjectConfig(projects);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("reserved");
  });

  it("detects path traversal", () => {
    const projects: ProjectConfig[] = [{ id: "../etc/passwd" }];
    const errors = validateProjectConfig(projects);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("Path traversal");
  });
});
