import { describe, expect, it, vi } from "vitest";
import { sessionsHandlers } from "./sessions.js";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({})),
  loadSessionStore: vi.fn(() => ({})),
  updateSessionStore: vi.fn(),
  resolveMainSessionKey: vi.fn(() => "agent:main:main"),
  snapshotSessionOrigin: vi.fn(() => undefined),
  resolveGatewaySessionStoreTarget: vi.fn(() => ({
    storePath: "/tmp/sessions.json",
    canonicalKey: "agent:main:test",
    storeKeys: ["agent:main:test"],
    agentId: "main",
  })),
  loadSessionEntry: vi.fn(() => ({
    cfg: {},
    storePath: "/tmp/sessions.json",
    store: {},
    entry: { sessionId: "old-session-id", updatedAt: Date.now() },
    canonicalKey: "agent:main:test",
  })),
  clearSessionQueues: vi.fn(),
  stopSubagentsForRequester: vi.fn(),
  abortEmbeddedPiRun: vi.fn(),
  waitForEmbeddedPiRunEnd: vi.fn(() => true),
  archiveSessionTranscripts: vi.fn(() => []),
}));

vi.mock("../../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/config.js")>();
  return {
    ...actual,
    loadConfig: mocks.loadConfig,
  };
});

vi.mock("../../config/sessions.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/sessions.js")>();
  return {
    ...actual,
    loadSessionStore: mocks.loadSessionStore,
    updateSessionStore: mocks.updateSessionStore,
    resolveMainSessionKey: mocks.resolveMainSessionKey,
    snapshotSessionOrigin: mocks.snapshotSessionOrigin,
  };
});

vi.mock("../../auto-reply/reply/queue.js", () => ({
  clearSessionQueues: mocks.clearSessionQueues,
}));

vi.mock("../../auto-reply/reply/abort.js", () => ({
  stopSubagentsForRequester: mocks.stopSubagentsForRequester,
}));

vi.mock("../../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: mocks.abortEmbeddedPiRun,
  waitForEmbeddedPiRunEnd: mocks.waitForEmbeddedPiRunEnd,
}));

vi.mock("../session-utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../session-utils.js")>();
  return {
    ...actual,
    resolveGatewaySessionStoreTarget: mocks.resolveGatewaySessionStoreTarget,
    loadSessionEntry: mocks.loadSessionEntry,
    archiveSessionTranscripts: mocks.archiveSessionTranscripts,
  };
});

describe("sessions.reset handler", () => {
  it("aborts active runs before resetting", async () => {
    mocks.updateSessionStore.mockImplementation(
      async (_path: string, updater: (store: Record<string, unknown>) => unknown) => {
        const store: Record<string, unknown> = {};
        return updater(store);
      },
    );

    const respond = vi.fn();
    await sessionsHandlers["sessions.reset"]({
      params: { key: "agent:main:test" },
      respond,
      context: {} as never,
      req: { type: "req", id: "1", method: "sessions.reset" },
      client: null,
      isWebchatConnect: () => false,
    });

    expect(mocks.clearSessionQueues).toHaveBeenCalled();
    expect(mocks.stopSubagentsForRequester).toHaveBeenCalled();
    expect(mocks.abortEmbeddedPiRun).toHaveBeenCalledWith("old-session-id");
    expect(mocks.waitForEmbeddedPiRunEnd).toHaveBeenCalledWith("old-session-id", 15_000);
    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ ok: true }), undefined);
  });

  it("returns error if active run cannot be stopped", async () => {
    mocks.waitForEmbeddedPiRunEnd.mockResolvedValueOnce(false);

    const respond = vi.fn();
    await sessionsHandlers["sessions.reset"]({
      params: { key: "agent:main:test" },
      respond,
      context: {} as never,
      req: { type: "req", id: "2", method: "sessions.reset" },
      client: null,
      isWebchatConnect: () => false,
    });

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("still active") }),
    );
  });

  it("preserves session overrides across reset", async () => {
    mocks.loadSessionEntry.mockReturnValueOnce({
      cfg: {},
      storePath: "/tmp/sessions.json",
      store: {},
      entry: {
        sessionId: "old-session-id",
        updatedAt: Date.now(),
        model: "claude-3-opus",
        sendPolicy: "deny",
        label: "My Session",
        thinkingLevel: "on",
      },
      canonicalKey: "agent:main:test",
    });

    let captured: Record<string, unknown> | undefined;
    mocks.updateSessionStore.mockImplementation(
      async (_path: string, updater: (store: Record<string, unknown>) => unknown) => {
        const store: Record<string, unknown> = {
          "agent:main:test": {
            sessionId: "old-session-id",
            model: "claude-3-opus",
            sendPolicy: "deny",
            label: "My Session",
            thinkingLevel: "on",
          },
        };
        const result = updater(store);
        captured = store["agent:main:test"] as Record<string, unknown>;
        return result;
      },
    );

    const respond = vi.fn();
    await sessionsHandlers["sessions.reset"]({
      params: { key: "agent:main:test" },
      respond,
      context: {} as never,
      req: { type: "req", id: "3", method: "sessions.reset" },
      client: null,
      isWebchatConnect: () => false,
    });

    expect(respond).toHaveBeenCalledWith(true, expect.anything(), undefined);
    expect(captured).toBeDefined();
    expect(captured?.model).toBe("claude-3-opus");
    expect(captured?.sendPolicy).toBe("deny");
    expect(captured?.label).toBe("My Session");
    expect(captured?.thinkingLevel).toBe("on");
    // sessionId should be new
    expect(captured?.sessionId).not.toBe("old-session-id");
  });

  it("archives transcripts before reset", async () => {
    mocks.updateSessionStore.mockImplementation(
      async (_path: string, updater: (store: Record<string, unknown>) => unknown) => {
        const store: Record<string, unknown> = {};
        return updater(store);
      },
    );

    const respond = vi.fn();
    await sessionsHandlers["sessions.reset"]({
      params: { key: "agent:main:test" },
      respond,
      context: {} as never,
      req: { type: "req", id: "4", method: "sessions.reset" },
      client: null,
      isWebchatConnect: () => false,
    });

    expect(mocks.archiveSessionTranscripts).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "old-session-id",
        reason: "reset",
      }),
    );
  });
});
