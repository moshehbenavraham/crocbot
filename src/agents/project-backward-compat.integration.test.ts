import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureProjectWorkspace,
  isDefaultProject,
  normalizeProjectId,
  resolveProjectContext,
  resolveProjectWorkspaceDir,
  validateProjectConfig,
} from "./project-scope.js";
import { DEFAULT_PROJECT_ID } from "../config/types.projects.js";

/* ------------------------------------------------------------------ */
/* Temp directory helpers                                              */
/* ------------------------------------------------------------------ */

let tmpDir: string;
let stateDir: string;
let workspaceDir: string;

function makeCfg(agentId = "main") {
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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-compat-"));
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
/* T012 - Backward compatibility: no-projects agent                   */
/* ------------------------------------------------------------------ */

describe("backward compatibility: agent with no projects config", () => {
  vi.mock("./agent-scope.js", () => ({
    resolveAgentDir: (_cfg: never, agentId: string) => {
      return path.join(stateDir, "agents", agentId, "agent");
    },
    resolveAgentWorkspaceDir: (_cfg: never, _agentId: string) => {
      return workspaceDir;
    },
  }));

  it("default project resolves to agent workspace directory", () => {
    const cfg = makeCfg("main");
    const dir = resolveProjectWorkspaceDir(cfg, "main", "default");
    expect(dir).toBe(workspaceDir);
  });

  it("default project resolves to agent workspace with null projectId", () => {
    const cfg = makeCfg("main");
    const dir = resolveProjectWorkspaceDir(cfg, "main", null);
    expect(dir).toBe(workspaceDir);
  });

  it("default project resolves to agent workspace with undefined projectId", () => {
    const cfg = makeCfg("main");
    const dir = resolveProjectWorkspaceDir(cfg, "main", undefined);
    expect(dir).toBe(workspaceDir);
  });

  it("default project resolves to agent workspace with empty string", () => {
    const cfg = makeCfg("main");
    const dir = resolveProjectWorkspaceDir(cfg, "main", "");
    expect(dir).toBe(workspaceDir);
  });

  it("resolveProjectContext returns default context transparently", async () => {
    const cfg = makeCfg("main");
    const ctx = await resolveProjectContext(cfg, "main", "default");
    expect(ctx.isDefault).toBe(true);
    expect(ctx.projectId).toBe(DEFAULT_PROJECT_ID);
    expect(ctx.paths).toBeUndefined();
    expect(ctx.workspaceDir).toBe(workspaceDir);
  });

  it("resolveProjectContext with null returns default context", async () => {
    const cfg = makeCfg("main");
    const ctx = await resolveProjectContext(cfg, "main", null);
    expect(ctx.isDefault).toBe(true);
    expect(ctx.projectId).toBe(DEFAULT_PROJECT_ID);
    expect(ctx.workspaceDir).toBe(workspaceDir);
  });

  it("resolveProjectContext with undefined returns default context", async () => {
    const cfg = makeCfg("main");
    const ctx = await resolveProjectContext(cfg, "main", undefined);
    expect(ctx.isDefault).toBe(true);
    expect(ctx.projectId).toBe(DEFAULT_PROJECT_ID);
    expect(ctx.workspaceDir).toBe(workspaceDir);
  });

  it("empty projects array validates without errors", () => {
    expect(validateProjectConfig([])).toEqual([]);
  });

  it("null projects config validates without errors", () => {
    expect(validateProjectConfig(null)).toEqual([]);
  });

  it("undefined projects config validates without errors", () => {
    expect(validateProjectConfig(undefined)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* T013 - Edge case tests                                             */
/* ------------------------------------------------------------------ */

describe("edge case: reserved name rejection", () => {
  it("rejects 'default' as a project name in config", () => {
    const errors = validateProjectConfig([{ id: "default" }]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("reserved");
  });

  it("rejects 'DEFAULT' (case-insensitive) as a project name", () => {
    const errors = validateProjectConfig([{ id: "DEFAULT" }]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("reserved");
  });

  it("normalizeProjectId returns default for 'default' input", () => {
    expect(normalizeProjectId("default")).toBe(DEFAULT_PROJECT_ID);
  });
});

describe("edge case: path traversal rejection", () => {
  it("rejects ../etc/passwd", () => {
    const errors = validateProjectConfig([{ id: "../etc/passwd" }]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("Path traversal");
  });

  it("normalizes ./sneaky to sneaky (not rejected)", () => {
    // Single dot is not path traversal; normalization strips invalid chars
    const errors = validateProjectConfig([{ id: "./sneaky" }]);
    expect(errors.length).toBe(0);
  });

  it("rejects embedded ../ in name", () => {
    const errors = validateProjectConfig([{ id: "foo/../bar" }]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("Path traversal");
  });

  it("normalizeProjectId throws on path traversal", () => {
    expect(() => normalizeProjectId("../etc/passwd")).toThrow();
  });
});

describe("edge case: nonexistent project switch", () => {
  vi.mock("./agent-scope.js", () => ({
    resolveAgentDir: (_cfg: never, agentId: string) => {
      return path.join(stateDir, "agents", agentId, "agent");
    },
    resolveAgentWorkspaceDir: (_cfg: never, _agentId: string) => {
      return workspaceDir;
    },
  }));

  it("resolveProjectContext for non-scaffolded project returns no metadata", async () => {
    const cfg = makeCfg("main");
    // Do NOT call ensureProjectWorkspace -- simulate switching to a project
    // that has never been created. The context should still resolve but
    // without metadata (the directory does not exist yet).
    const ctx = await resolveProjectContext(cfg, "main", "ghost");
    expect(ctx.isDefault).toBe(false);
    expect(ctx.projectId).toBe("ghost");
    expect(ctx.metadata).toBeUndefined();
  });
});

describe("edge case: delete active project fallback", () => {
  vi.mock("./agent-scope.js", () => ({
    resolveAgentDir: (_cfg: never, agentId: string) => {
      return path.join(stateDir, "agents", agentId, "agent");
    },
    resolveAgentWorkspaceDir: (_cfg: never, _agentId: string) => {
      return workspaceDir;
    },
  }));

  it("after deleting project directory, resolveProjectContext returns no metadata", async () => {
    const cfg = makeCfg("main");

    // Create the project
    const paths = await ensureProjectWorkspace(cfg, "main", "doomed");
    const ctx1 = await resolveProjectContext(cfg, "main", "doomed");
    expect(ctx1.metadata).toBeDefined();

    // Delete the project directory
    await fs.rm(paths.projectDir, { recursive: true, force: true });

    // Resolving context again should gracefully return no metadata
    const ctx2 = await resolveProjectContext(cfg, "main", "doomed");
    expect(ctx2.isDefault).toBe(false);
    expect(ctx2.projectId).toBe("doomed");
    expect(ctx2.metadata).toBeUndefined();
  });

  it("default project is always available regardless of named project state", async () => {
    const cfg = makeCfg("main");

    // Create and delete a named project
    const paths = await ensureProjectWorkspace(cfg, "main", "temp");
    await fs.rm(paths.projectDir, { recursive: true, force: true });

    // Default project should still resolve fine
    const defaultCtx = await resolveProjectContext(cfg, "main", "default");
    expect(defaultCtx.isDefault).toBe(true);
    expect(defaultCtx.workspaceDir).toBe(workspaceDir);
  });
});

describe("edge case: duplicate project detection", () => {
  it("detects normalized duplicates", () => {
    const errors = validateProjectConfig([{ id: "MyApp" }, { id: "myapp" }]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("Duplicate");
  });

  it("detects exact duplicates", () => {
    const errors = validateProjectConfig([{ id: "webapp" }, { id: "webapp" }]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("Duplicate");
  });
});

describe("edge case: isDefaultProject detection", () => {
  it("identifies empty string as default", () => {
    expect(isDefaultProject("")).toBe(true);
  });

  it("identifies null as default", () => {
    expect(isDefaultProject(null)).toBe(true);
  });

  it("identifies undefined as default", () => {
    expect(isDefaultProject(undefined)).toBe(true);
  });

  it("identifies 'default' as default", () => {
    expect(isDefaultProject("default")).toBe(true);
  });

  it("does not identify named project as default", () => {
    expect(isDefaultProject("myapp")).toBe(false);
  });
});
