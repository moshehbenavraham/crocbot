import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseProjectSubcommand, executeProjectSubcommand } from "./project-command.js";

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  loadConfigReturn: {} as Record<string, unknown>,
  listAgentEntries: vi.fn(
    () => [] as Array<{ id: string; projects?: Array<Record<string, unknown>> }>,
  ),
  findAgentEntryIndex: vi.fn(() => 0),
  writeConfigFile: vi.fn(async () => {}),
  ensureProjectWorkspace: vi.fn(async () => ({
    workspaceDir: "/workspace/main/projects/myapp",
    projectDir: "/state/projects/main/myapp",
  })),
}));

vi.mock("../config/config.js", () => ({
  loadConfig: () => mocks.loadConfigReturn,
  writeConfigFile: mocks.writeConfigFile,
}));

vi.mock("../commands/agents.config.js", () => ({
  listAgentEntries: mocks.listAgentEntries,
  findAgentEntryIndex: mocks.findAgentEntryIndex,
}));

vi.mock("../agents/project-scope.js", () => ({
  ensureProjectWorkspace: mocks.ensureProjectWorkspace,
  isDefaultProject: (id: string) => !id || id === "default",
  normalizeProjectId: (id?: string) => (id ?? "").trim().toLowerCase() || "default",
}));

// Mock fs and paths to avoid touching the filesystem
vi.mock("../config/paths.js", () => ({
  STATE_DIR: "/tmp/test-state",
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    default: {
      ...actual,
      readFile: vi.fn(async () => "{}"),
      writeFile: vi.fn(async () => {}),
      mkdir: vi.fn(async () => undefined),
    },
  };
});

/* ------------------------------------------------------------------ */
/* parseProjectSubcommand tests                                       */
/* ------------------------------------------------------------------ */

describe("parseProjectSubcommand", () => {
  it("returns help for empty input", () => {
    expect(parseProjectSubcommand("")).toEqual({ action: "help" });
    expect(parseProjectSubcommand("  ")).toEqual({ action: "help" });
  });

  it("parses list subcommand", () => {
    expect(parseProjectSubcommand("list")).toEqual({ action: "list" });
  });

  it("parses ls alias for list", () => {
    expect(parseProjectSubcommand("ls")).toEqual({ action: "list" });
  });

  it("parses current subcommand", () => {
    expect(parseProjectSubcommand("current")).toEqual({ action: "current" });
  });

  it("parses status alias for current", () => {
    expect(parseProjectSubcommand("status")).toEqual({ action: "current" });
  });

  it("parses switch subcommand with argument", () => {
    expect(parseProjectSubcommand("switch myapp")).toEqual({
      action: "switch",
      projectId: "myapp",
    });
  });

  it("parses use alias for switch", () => {
    expect(parseProjectSubcommand("use myapp")).toEqual({
      action: "switch",
      projectId: "myapp",
    });
  });

  it("returns help when switch has no argument", () => {
    expect(parseProjectSubcommand("switch")).toEqual({ action: "help" });
  });

  it("parses create subcommand with argument", () => {
    expect(parseProjectSubcommand("create myapp")).toEqual({
      action: "create",
      projectId: "myapp",
    });
  });

  it("parses new alias for create", () => {
    expect(parseProjectSubcommand("new myapp")).toEqual({
      action: "create",
      projectId: "myapp",
    });
  });

  it("returns help when create has no argument", () => {
    expect(parseProjectSubcommand("create")).toEqual({ action: "help" });
  });

  it("treats bare argument as switch shortcut", () => {
    expect(parseProjectSubcommand("myapp")).toEqual({
      action: "switch",
      projectId: "myapp",
    });
  });

  it("is case-insensitive for subcommands", () => {
    expect(parseProjectSubcommand("LIST")).toEqual({ action: "list" });
    expect(parseProjectSubcommand("SWITCH myapp")).toEqual({
      action: "switch",
      projectId: "myapp",
    });
  });
});

/* ------------------------------------------------------------------ */
/* executeProjectSubcommand tests                                     */
/* ------------------------------------------------------------------ */

function makeContext(overrides?: Partial<Parameters<typeof executeProjectSubcommand>[1]>) {
  let activeProject = "default";
  return {
    agentId: "main",
    getActiveProjectId: () => activeProject,
    setActiveProjectId: (id: string) => {
      activeProject = id;
    },
    ...overrides,
  };
}

describe("executeProjectSubcommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigReturn = {};
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [] }]);
    mocks.findAgentEntryIndex.mockReturnValue(0);
  });

  it("returns help text for help action", async () => {
    const result = await executeProjectSubcommand({ action: "help" }, makeContext());
    expect(result.ok).toBe(true);
    expect(result.text).toContain("/project list");
    expect(result.text).toContain("/project switch");
  });

  it("returns current project", async () => {
    const ctx = makeContext();
    const result = await executeProjectSubcommand({ action: "current" }, ctx);
    expect(result.ok).toBe(true);
    expect(result.text).toContain("default");
  });

  it("returns current non-default project", async () => {
    let active = "myapp";
    const ctx = makeContext({
      getActiveProjectId: () => active,
      setActiveProjectId: (id) => {
        active = id;
      },
    });
    const result = await executeProjectSubcommand({ action: "current" }, ctx);
    expect(result.ok).toBe(true);
    expect(result.text).toContain("myapp");
  });

  it("lists projects including default", async () => {
    mocks.listAgentEntries.mockReturnValue([
      { id: "main", projects: [{ id: "webapp", name: "Web App" }] },
    ]);
    const result = await executeProjectSubcommand({ action: "list" }, makeContext());
    expect(result.ok).toBe(true);
    expect(result.text).toContain("default");
    expect(result.text).toContain("webapp");
  });

  it("switches to existing project", async () => {
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [{ id: "myapp" }] }]);
    const ctx = makeContext();
    const result = await executeProjectSubcommand({ action: "switch", projectId: "myapp" }, ctx);
    expect(result.ok).toBe(true);
    expect(result.text).toContain("myapp");
    expect(ctx.getActiveProjectId()).toBe("myapp");
  });

  it("switches to default project", async () => {
    let active = "myapp";
    const ctx = makeContext({
      getActiveProjectId: () => active,
      setActiveProjectId: (id) => {
        active = id;
      },
    });
    const result = await executeProjectSubcommand({ action: "switch", projectId: "default" }, ctx);
    expect(result.ok).toBe(true);
    expect(result.text).toContain("default");
  });

  it("rejects switching to nonexistent project", async () => {
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [] }]);
    const result = await executeProjectSubcommand(
      { action: "switch", projectId: "ghost" },
      makeContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.text).toContain("not found");
  });

  it("creates a project successfully", async () => {
    const result = await executeProjectSubcommand(
      { action: "create", projectId: "newapp" },
      makeContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.text).toContain("created");
    expect(mocks.ensureProjectWorkspace).toHaveBeenCalled();
    expect(mocks.writeConfigFile).toHaveBeenCalled();
  });

  it("rejects creating default project", async () => {
    const result = await executeProjectSubcommand(
      { action: "create", projectId: "default" },
      makeContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.text).toContain("reserved");
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("rejects creating duplicate project", async () => {
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [{ id: "myapp" }] }]);
    const result = await executeProjectSubcommand(
      { action: "create", projectId: "myapp" },
      makeContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.text).toContain("already exists");
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });
});
