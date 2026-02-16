import { describe, expect, it, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  loadConfigReturn: {} as Record<string, unknown>,
  listAgentIds: vi.fn(() => ["main"]),
  resolveAgentWorkspaceDir: vi.fn(() => "/workspace/main"),
  listAgentEntries: vi.fn(
    () =>
      [] as Array<{
        id: string;
        projects?: Array<Record<string, unknown>>;
        defaultProject?: string;
      }>,
  ),
  findAgentEntryIndex: vi.fn(() => 0),
  writeConfigFile: vi.fn(async () => {}),
  ensureProjectWorkspace: vi.fn(async () => ({
    workspaceDir: "/workspace/main/projects/myapp",
    projectDir: "/state/projects/main/myapp",
  })),
  resolveProjectContext: vi.fn(async () => ({
    projectId: "myapp",
    workspaceDir: "/workspace/main/projects/myapp",
    metadata: { createdAt: "2026-01-01T00:00:00Z", lastAccessedAt: "2026-02-01T00:00:00Z" },
  })),
  resolveProjectDir: vi.fn(() => "/state/projects/main/myapp"),
  resolveProjectPaths: vi.fn(() => ({
    workspaceDir: "/workspace/main/projects/myapp",
    memoryDir: "/state/memory/main/myapp",
  })),
  movePathToTrash: vi.fn(async () => "/trashed"),
  fsAccess: vi.fn(async () => {}),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: () => mocks.loadConfigReturn,
  writeConfigFile: mocks.writeConfigFile,
}));

vi.mock("../../agents/agent-scope.js", () => ({
  listAgentIds: mocks.listAgentIds,
  resolveAgentWorkspaceDir: mocks.resolveAgentWorkspaceDir,
}));

vi.mock("../../commands/agents.config.js", () => ({
  listAgentEntries: mocks.listAgentEntries,
  findAgentEntryIndex: mocks.findAgentEntryIndex,
}));

vi.mock("../../agents/project-scope.js", () => ({
  ensureProjectWorkspace: mocks.ensureProjectWorkspace,
  isDefaultProject: (id: string) => !id || id === "default",
  normalizeProjectId: (id?: string) => (id ?? "").trim().toLowerCase() || "default",
  resolveProjectContext: mocks.resolveProjectContext,
  resolveProjectDir: mocks.resolveProjectDir,
  resolveProjectPaths: mocks.resolveProjectPaths,
}));

vi.mock("../../browser/trash.js", () => ({
  movePathToTrash: mocks.movePathToTrash,
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const patched = { ...actual, access: mocks.fsAccess };
  return { ...patched, default: patched };
});

/* ------------------------------------------------------------------ */
/* Import after mocks are set up                                      */
/* ------------------------------------------------------------------ */

const { projectsHandlers } = await import("./projects.js");

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeCall(method: keyof typeof projectsHandlers, params: Record<string, unknown>) {
  const respond = vi.fn();
  const handler = projectsHandlers[method];
  const promise = handler({
    params,
    respond,
    context: {} as never,
    req: { type: "req" as const, id: "1", method },
    client: null,
    isWebchatConnect: () => false,
  });
  return { respond, promise };
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe("projects.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigReturn = {};
    mocks.listAgentIds.mockReturnValue(["main"]);
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [] }]);
  });

  it("returns default project when no custom projects configured", async () => {
    mocks.listAgentEntries.mockReturnValue([{ id: "main" }]);
    const { respond, promise } = makeCall("projects.list", { agentId: "main" });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        agentId: "main",
        projects: [expect.objectContaining({ id: "default", isDefault: true })],
      }),
      undefined,
    );
  });

  it("includes configured projects alongside default", async () => {
    mocks.listAgentEntries.mockReturnValue([
      { id: "main", projects: [{ id: "myapp", name: "My App" }] },
    ]);
    const { respond, promise } = makeCall("projects.list", { agentId: "main" });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        projects: expect.arrayContaining([
          expect.objectContaining({ id: "default", isDefault: true }),
          expect.objectContaining({ id: "myapp", isDefault: false }),
        ]),
      }),
      undefined,
    );
  });

  it("rejects unknown agent id", async () => {
    mocks.listAgentIds.mockReturnValue(["main"]);
    const { respond, promise } = makeCall("projects.list", { agentId: "unknown-agent" });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("unknown agent") }),
    );
  });
});

describe("projects.current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigReturn = {};
    mocks.listAgentIds.mockReturnValue(["main"]);
    mocks.listAgentEntries.mockReturnValue([{ id: "main" }]);
    delete process.env.CROCBOT_ACTIVE_PROJECT;
  });

  it("returns default project when no override set", () => {
    const { respond } = makeCall("projects.current", { agentId: "main" });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ projectId: "default", isDefault: true }),
      undefined,
    );
  });

  it("reads project from env when set", () => {
    process.env.CROCBOT_ACTIVE_PROJECT = "myapp";
    const { respond } = makeCall("projects.current", { agentId: "main" });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ projectId: "myapp", isDefault: false }),
      undefined,
    );
    delete process.env.CROCBOT_ACTIVE_PROJECT;
  });

  it("reads project from agent default when configured", () => {
    mocks.listAgentEntries.mockReturnValue([{ id: "main", defaultProject: "webapp" }]);
    const { respond } = makeCall("projects.current", { agentId: "main" });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ projectId: "webapp", isDefault: false }),
      undefined,
    );
  });

  it("rejects unknown agent id", () => {
    mocks.listAgentIds.mockReturnValue(["main"]);
    const { respond } = makeCall("projects.current", { agentId: "nonexistent" });

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("unknown agent") }),
    );
  });
});

describe("projects.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigReturn = {};
    mocks.listAgentIds.mockReturnValue(["main"]);
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [] }]);
    mocks.findAgentEntryIndex.mockReturnValue(0);
  });

  it("creates a project successfully", async () => {
    const { respond, promise } = makeCall("projects.create", {
      agentId: "main",
      projectId: "myapp",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ ok: true, agentId: "main", projectId: "myapp" }),
      undefined,
    );
    expect(mocks.ensureProjectWorkspace).toHaveBeenCalled();
    expect(mocks.writeConfigFile).toHaveBeenCalled();
  });

  it("bootstraps workspace before writing config", async () => {
    const callOrder: string[] = [];
    mocks.ensureProjectWorkspace.mockImplementation(async () => {
      callOrder.push("ensureProjectWorkspace");
      return { workspaceDir: "/ws", projectDir: "/dir" };
    });
    mocks.writeConfigFile.mockImplementation(async () => {
      callOrder.push("writeConfigFile");
    });

    const { promise } = makeCall("projects.create", {
      agentId: "main",
      projectId: "newproject",
    });
    await promise;

    expect(callOrder.indexOf("ensureProjectWorkspace")).toBeLessThan(
      callOrder.indexOf("writeConfigFile"),
    );
  });

  it("rejects creating default project", async () => {
    const { respond, promise } = makeCall("projects.create", {
      agentId: "main",
      projectId: "default",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("reserved") }),
    );
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("rejects creating a duplicate project", async () => {
    mocks.listAgentEntries.mockReturnValue([
      { id: "main", projects: [{ id: "myapp", name: "My App" }] },
    ]);

    const { respond, promise } = makeCall("projects.create", {
      agentId: "main",
      projectId: "myapp",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("already exists") }),
    );
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("rejects unknown agent id", async () => {
    mocks.listAgentIds.mockReturnValue(["main"]);
    const { respond, promise } = makeCall("projects.create", {
      agentId: "ghost",
      projectId: "app",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("unknown agent") }),
    );
  });
});

describe("projects.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigReturn = {};
    mocks.listAgentIds.mockReturnValue(["main"]);
    mocks.listAgentEntries.mockReturnValue([
      { id: "main", projects: [{ id: "myapp", name: "My App" }] },
    ]);
    mocks.findAgentEntryIndex.mockReturnValue(0);
  });

  it("deletes an existing project", async () => {
    const { respond, promise } = makeCall("projects.delete", {
      agentId: "main",
      projectId: "myapp",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ ok: true, agentId: "main", projectId: "myapp" }),
      undefined,
    );
    expect(mocks.writeConfigFile).toHaveBeenCalled();
  });

  it("rejects deleting default project", async () => {
    const { respond, promise } = makeCall("projects.delete", {
      agentId: "main",
      projectId: "default",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("cannot be deleted") }),
    );
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("rejects deleting nonexistent project", async () => {
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [] }]);
    const { respond, promise } = makeCall("projects.delete", {
      agentId: "main",
      projectId: "ghost",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("not found") }),
    );
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("clears defaultProject when deleting the default project for agent", async () => {
    mocks.listAgentEntries.mockReturnValue([
      { id: "main", projects: [{ id: "myapp" }], defaultProject: "myapp" },
    ]);
    const { promise } = makeCall("projects.delete", {
      agentId: "main",
      projectId: "myapp",
    });
    await promise;

    expect(mocks.writeConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: expect.objectContaining({
          list: expect.arrayContaining([expect.not.objectContaining({ defaultProject: "myapp" })]),
        }),
      }),
    );
  });
});

describe("projects.switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigReturn = {};
    mocks.listAgentIds.mockReturnValue(["main"]);
    mocks.listAgentEntries.mockReturnValue([
      { id: "main", projects: [{ id: "myapp", name: "My App" }] },
    ]);
    delete process.env.CROCBOT_ACTIVE_PROJECT;
  });

  it("switches to an existing project", async () => {
    const { respond, promise } = makeCall("projects.switch", {
      agentId: "main",
      projectId: "myapp",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ ok: true, agentId: "main", projectId: "myapp" }),
      undefined,
    );
    expect(process.env.CROCBOT_ACTIVE_PROJECT).toBe("myapp");
  });

  it("switches to default project and clears env", async () => {
    process.env.CROCBOT_ACTIVE_PROJECT = "myapp";
    const { respond, promise } = makeCall("projects.switch", {
      agentId: "main",
      projectId: "default",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ ok: true, projectId: "default" }),
      undefined,
    );
    expect(process.env.CROCBOT_ACTIVE_PROJECT).toBeUndefined();
  });

  it("rejects switching to nonexistent project", async () => {
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [] }]);
    const { respond, promise } = makeCall("projects.switch", {
      agentId: "main",
      projectId: "ghost",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("not found") }),
    );
  });

  it("rejects unknown agent id", async () => {
    mocks.listAgentIds.mockReturnValue(["main"]);
    const { respond, promise } = makeCall("projects.switch", {
      agentId: "ghost",
      projectId: "myapp",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("unknown agent") }),
    );
  });

  it("reports previous project in response", async () => {
    process.env.CROCBOT_ACTIVE_PROJECT = "oldproject";
    const { respond, promise } = makeCall("projects.switch", {
      agentId: "main",
      projectId: "myapp",
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ previousProjectId: "oldproject" }),
      undefined,
    );
  });
});

/* ------------------------------------------------------------------ */
/* projects.current -- sessionKey parameter resolution                */
/* ------------------------------------------------------------------ */

describe("projects.current sessionKey resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigReturn = {};
    mocks.listAgentIds.mockReturnValue(["main"]);
    mocks.listAgentEntries.mockReturnValue([{ id: "main" }]);
    delete process.env.CROCBOT_ACTIVE_PROJECT;
  });

  it("extracts project from sessionKey when present", () => {
    const { respond } = makeCall("projects.current", {
      agentId: "main",
      sessionKey: "agent:main:project:webapp:telegram:dm:100",
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ projectId: "webapp", isDefault: false }),
      undefined,
    );
  });

  it("sessionKey takes precedence over env var", () => {
    process.env.CROCBOT_ACTIVE_PROJECT = "envproject";
    const { respond } = makeCall("projects.current", {
      agentId: "main",
      sessionKey: "agent:main:project:keyproject:telegram:dm:100",
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ projectId: "keyproject" }),
      undefined,
    );
    delete process.env.CROCBOT_ACTIVE_PROJECT;
  });

  it("falls back to env when sessionKey has no project segment", () => {
    process.env.CROCBOT_ACTIVE_PROJECT = "envproject";
    const { respond } = makeCall("projects.current", {
      agentId: "main",
      sessionKey: "agent:main:telegram:dm:100",
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ projectId: "envproject" }),
      undefined,
    );
    delete process.env.CROCBOT_ACTIVE_PROJECT;
  });
});

/* ------------------------------------------------------------------ */
/* Validation error shape consistency                                 */
/* ------------------------------------------------------------------ */

describe("projects error shape consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigReturn = {};
    mocks.listAgentIds.mockReturnValue(["main"]);
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [] }]);
    mocks.findAgentEntryIndex.mockReturnValue(0);
  });

  it("projects.list error includes code and message", async () => {
    mocks.listAgentIds.mockReturnValue(["main"]);
    const { respond, promise } = makeCall("projects.list", { agentId: "ghost" });
    await promise;

    const errorArg = respond.mock.calls[0][2];
    expect(errorArg).toHaveProperty("code");
    expect(errorArg).toHaveProperty("message");
    expect(typeof errorArg.message).toBe("string");
  });

  it("projects.create error includes code and message", async () => {
    const { respond, promise } = makeCall("projects.create", {
      agentId: "main",
      projectId: "default",
    });
    await promise;

    const errorArg = respond.mock.calls[0][2];
    expect(errorArg).toHaveProperty("code");
    expect(errorArg).toHaveProperty("message");
  });

  it("projects.delete error includes code and message", async () => {
    const { respond, promise } = makeCall("projects.delete", {
      agentId: "main",
      projectId: "default",
    });
    await promise;

    const errorArg = respond.mock.calls[0][2];
    expect(errorArg).toHaveProperty("code");
    expect(errorArg).toHaveProperty("message");
  });

  it("projects.switch error includes code and message", async () => {
    mocks.listAgentEntries.mockReturnValue([{ id: "main", projects: [] }]);
    const { respond, promise } = makeCall("projects.switch", {
      agentId: "main",
      projectId: "nonexistent",
    });
    await promise;

    const errorArg = respond.mock.calls[0][2];
    expect(errorArg).toHaveProperty("code");
    expect(errorArg).toHaveProperty("message");
  });
});
