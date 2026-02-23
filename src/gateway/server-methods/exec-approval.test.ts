import { describe, expect, it, vi } from "vitest";
import { ExecApprovalManager } from "../exec-approval-manager.js";
import {
  createExecApprovalHandlers,
  sanitizeNodeInvokeParams,
  sanitizeSystemRunForForwarding,
} from "./exec-approval.js";
import { validateExecApprovalRequestParams } from "../protocol/index.js";

const noop = () => {};

describe("exec approval handlers", () => {
  describe("ExecApprovalRequestParams validation", () => {
    it("accepts request with resolvedPath omitted", () => {
      const params = {
        command: "echo hi",
        cwd: "/tmp",
        host: "node",
      };
      expect(validateExecApprovalRequestParams(params)).toBe(true);
    });

    it("accepts request with resolvedPath as string", () => {
      const params = {
        command: "echo hi",
        cwd: "/tmp",
        host: "node",
        resolvedPath: "/usr/bin/echo",
      };
      expect(validateExecApprovalRequestParams(params)).toBe(true);
    });

    it("accepts request with resolvedPath as undefined", () => {
      const params = {
        command: "echo hi",
        cwd: "/tmp",
        host: "node",
        resolvedPath: undefined,
      };
      expect(validateExecApprovalRequestParams(params)).toBe(true);
    });

    // Fixed: null is now accepted (Type.Union([Type.String(), Type.Null()]))
    // This matches the calling code in bash-tools.exec.ts which passes null.
    it("accepts request with resolvedPath as null", () => {
      const params = {
        command: "echo hi",
        cwd: "/tmp",
        host: "node",
        resolvedPath: null,
      };
      expect(validateExecApprovalRequestParams(params)).toBe(true);
    });
  });

  it("broadcasts request + resolve", async () => {
    const manager = new ExecApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];

    const respond = vi.fn();
    const context = {
      broadcast: (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
    };

    const requestPromise = handlers["exec.approval.request"]({
      params: {
        command: "echo ok",
        cwd: "/tmp",
        host: "node",
        timeoutMs: 2000,
      },
      respond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    const requested = broadcasts.find((entry) => entry.event === "exec.approval.requested");
    expect(requested).toBeTruthy();
    const id = (requested?.payload as { id?: string })?.id ?? "";
    expect(id).not.toBe("");

    const resolveRespond = vi.fn();
    await handlers["exec.approval.resolve"]({
      params: { id, decision: "allow-once" },
      respond: resolveRespond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.resolve"]
      >[0]["context"],
      client: { connect: { client: { id: "cli", displayName: "CLI" } } },
      req: { id: "req-2", type: "req", method: "exec.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;

    expect(resolveRespond).toHaveBeenCalledWith(true, { ok: true }, undefined);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ id, decision: "allow-once" }),
      undefined,
    );
    expect(broadcasts.some((entry) => entry.event === "exec.approval.resolved")).toBe(true);
  });

  it("accepts resolve during broadcast", async () => {
    const manager = new ExecApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const respond = vi.fn();
    const resolveRespond = vi.fn();

    const resolveContext = {
      broadcast: () => {},
    };

    const context = {
      broadcast: (event: string, payload: unknown) => {
        if (event !== "exec.approval.requested") {
          return;
        }
        const id = (payload as { id?: string })?.id ?? "";
        void handlers["exec.approval.resolve"]({
          params: { id, decision: "allow-once" },
          respond: resolveRespond,
          context: resolveContext as unknown as Parameters<
            (typeof handlers)["exec.approval.resolve"]
          >[0]["context"],
          client: { connect: { client: { id: "cli", displayName: "CLI" } } },
          req: { id: "req-2", type: "req", method: "exec.approval.resolve" },
          isWebchatConnect: noop,
        });
      },
    };

    await handlers["exec.approval.request"]({
      params: {
        command: "echo ok",
        cwd: "/tmp",
        host: "node",
        timeoutMs: 2000,
      },
      respond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    expect(resolveRespond).toHaveBeenCalledWith(true, { ok: true }, undefined);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ decision: "allow-once" }),
      undefined,
    );
  });

  it("accepts explicit approval ids", async () => {
    const manager = new ExecApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];

    const respond = vi.fn();
    const context = {
      broadcast: (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
    };

    const requestPromise = handlers["exec.approval.request"]({
      params: {
        id: "approval-123",
        command: "echo ok",
        cwd: "/tmp",
        host: "gateway",
        timeoutMs: 2000,
      },
      respond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    const requested = broadcasts.find((entry) => entry.event === "exec.approval.requested");
    const id = (requested?.payload as { id?: string })?.id ?? "";
    expect(id).toBe("approval-123");

    const resolveRespond = vi.fn();
    await handlers["exec.approval.resolve"]({
      params: { id, decision: "allow-once" },
      respond: resolveRespond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.resolve"]
      >[0]["context"],
      client: { connect: { client: { id: "cli", displayName: "CLI" } } },
      req: { id: "req-2", type: "req", method: "exec.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ id: "approval-123", decision: "allow-once" }),
      undefined,
    );
  });

  it("rejects self-approval (same clientId)", async () => {
    const manager = new ExecApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const broadcasts: Array<{ event: string; payload: unknown }> = [];

    const respond = vi.fn();
    const context = {
      broadcast: (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
    };

    const sameClient = { connect: { client: { id: "agent-x", displayName: "Agent X" } } };

    void handlers["exec.approval.request"]({
      params: { command: "rm -rf /", timeoutMs: 2000 },
      respond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: sameClient,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    const requested = broadcasts.find((e) => e.event === "exec.approval.requested");
    const id = (requested?.payload as { id?: string })?.id ?? "";

    const resolveRespond = vi.fn();
    await handlers["exec.approval.resolve"]({
      params: { id, decision: "allow-once" },
      respond: resolveRespond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.resolve"]
      >[0]["context"],
      client: sameClient,
      req: { id: "req-2", type: "req", method: "exec.approval.resolve" },
      isWebchatConnect: noop,
    });

    expect(resolveRespond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "cannot resolve own exec approval" }),
    );
  });

  it("rejects duplicate approval ids", async () => {
    const manager = new ExecApprovalManager();
    const handlers = createExecApprovalHandlers(manager);
    const respondA = vi.fn();
    const respondB = vi.fn();
    const broadcasts: Array<{ event: string; payload: unknown }> = [];
    const context = {
      broadcast: (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
    };

    const requestPromise = handlers["exec.approval.request"]({
      params: {
        id: "dup-1",
        command: "echo ok",
      },
      respond: respondA,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    await handlers["exec.approval.request"]({
      params: {
        id: "dup-1",
        command: "echo again",
      },
      respond: respondB,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.request"]
      >[0]["context"],
      client: null,
      req: { id: "req-2", type: "req", method: "exec.approval.request" },
      isWebchatConnect: noop,
    });

    expect(respondB).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "approval id already pending" }),
    );

    const requested = broadcasts.find((entry) => entry.event === "exec.approval.requested");
    const id = (requested?.payload as { id?: string })?.id ?? "";
    const resolveRespond = vi.fn();
    await handlers["exec.approval.resolve"]({
      params: { id, decision: "deny" },
      respond: resolveRespond,
      context: context as unknown as Parameters<
        (typeof handlers)["exec.approval.resolve"]
      >[0]["context"],
      client: { connect: { client: { id: "cli", displayName: "CLI" } } },
      req: { id: "req-3", type: "req", method: "exec.approval.resolve" },
      isWebchatConnect: noop,
    });

    await requestPromise;
  });
});

describe("ExecApprovalManager.validateDeviceBinding", () => {
  it("accepts matching device id", () => {
    const manager = new ExecApprovalManager();
    const record = manager.create({ command: "echo hi" }, 5000, "binding-1");
    record.requestedByDeviceId = "device-abc";
    record.requestedByConnId = "conn-1";
    void manager.waitForDecision(record, 5000);

    const result = manager.validateDeviceBinding("binding-1", "device-abc", "conn-other");
    expect(result.ok).toBe(true);
  });

  it("rejects mismatched device id", () => {
    const manager = new ExecApprovalManager();
    const record = manager.create({ command: "echo hi" }, 5000, "binding-2");
    record.requestedByDeviceId = "device-abc";
    void manager.waitForDecision(record, 5000);

    const result = manager.validateDeviceBinding("binding-2", "device-xyz", null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("APPROVAL_DEVICE_MISMATCH");
    }
  });

  it("falls back to connId when device id is absent", () => {
    const manager = new ExecApprovalManager();
    const record = manager.create({ command: "echo hi" }, 5000, "binding-3");
    record.requestedByDeviceId = null;
    record.requestedByConnId = "conn-abc";
    void manager.waitForDecision(record, 5000);

    const ok = manager.validateDeviceBinding("binding-3", null, "conn-abc");
    expect(ok.ok).toBe(true);

    const fail = manager.validateDeviceBinding("binding-3", null, "conn-xyz");
    expect(fail.ok).toBe(false);
    if (!fail.ok) {
      expect(fail.code).toBe("APPROVAL_CLIENT_MISMATCH");
    }
  });

  it("returns error for unknown approval id", () => {
    const manager = new ExecApprovalManager();
    const result = manager.validateDeviceBinding("nonexistent", "d", "c");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNKNOWN_APPROVAL");
    }
  });
});

describe("sanitizeSystemRunForForwarding", () => {
  it("strips injected fields from params", () => {
    const manager = new ExecApprovalManager();
    const result = sanitizeSystemRunForForwarding({
      rawParams: {
        command: ["echo", "hi"],
        rawCommand: "echo hi",
        cwd: "/tmp",
        approved: true,
        approvalDecision: "allow-always",
        injected: "malicious",
      },
      client: null,
      execApprovalManager: manager,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const p: Record<string, unknown> = result.params;
      expect(p.command).toEqual(["echo", "hi"]);
      expect(p.rawCommand).toBe("echo hi");
      expect(p.injected).toBeUndefined();
      expect(p.approved).toBeUndefined();
      expect(p.approvalDecision).toBeUndefined();
    }
  });

  it("injects approval fields from validated record", () => {
    const manager = new ExecApprovalManager();
    const record = manager.create({ command: "echo hi" }, 5000, "run-1");
    record.requestedByDeviceId = "device-a";
    void manager.waitForDecision(record, 5000);
    manager.resolve("run-1", "allow-once");

    // Create a new approval for the test since resolving consumes the entry
    const record2 = manager.create({ command: "echo hi" }, 5000, "run-2");
    record2.requestedByDeviceId = "device-a";
    record2.decision = "allow-always";
    void manager.waitForDecision(record2, 5000);

    const result = sanitizeSystemRunForForwarding({
      rawParams: { command: ["echo", "hi"], runId: "run-2" },
      client: { connect: { device: { id: "device-a" } } } as unknown as Parameters<
        typeof sanitizeSystemRunForForwarding
      >[0]["client"],
      execApprovalManager: manager,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params.approved).toBe(true);
      expect(result.params.approvalDecision).toBe("allow-always");
    }
  });
});

describe("sanitizeNodeInvokeParams", () => {
  it("passes non-system.run commands through unchanged", () => {
    const manager = new ExecApprovalManager();
    const params = { foo: "bar" };
    const result = sanitizeNodeInvokeParams({
      command: "camera.snap",
      rawParams: params,
      client: null,
      execApprovalManager: manager,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params).toBe(params);
    }
  });

  it("sanitizes system.run params", () => {
    const manager = new ExecApprovalManager();
    const result = sanitizeNodeInvokeParams({
      command: "system.run",
      rawParams: { command: ["ls"], injected: true },
      client: null,
      execApprovalManager: manager,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p: Record<string, unknown> = result.params;
      expect(p.command).toEqual(["ls"]);
      expect(p.injected).toBeUndefined();
    }
  });
});
