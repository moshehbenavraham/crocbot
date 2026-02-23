// Node/Device gateway method handlers.
// Device pairing stubs remain (pairing DB was stripped), but node management
// methods now use the live NodeRegistry so connected nodes are visible.

import { loadConfig } from "../../config/config.js";
import {
  isNodeCommandAllowed,
  requiresExecApproval,
  resolveNodeCommandAllowlist,
} from "../node-command-policy.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateNodeDescribeParams,
  validateNodeEventParams,
  validateNodeInvokeParams,
  validateNodeInvokeResultParams,
  validateNodeListParams,
} from "../protocol/index.js";
import { sanitizeNodeInvokeParams as sanitizeNodeInvokeParamsFromApproval } from "./exec-approval.js";
import { safeParseJson } from "./nodes.helpers.js";
import type { GatewayRequestHandlers } from "./types.js";

const FEATURE_DISABLED_ERROR = errorShape(
  ErrorCodes.INVALID_REQUEST,
  "Node/device functionality is not available in this deployment",
);

export const nodesHandlers: GatewayRequestHandlers = {
  // Node pairing methods
  "node.pair.request": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.pair.list": async ({ respond }) => {
    // Return { pending: [], paired: [] } to match client expectations (format.ts, nodes-utils.ts)
    respond(true, { pending: [], paired: [] }, undefined);
  },
  "node.pair.approve": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.pair.reject": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.pair.verify": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },

  // Device pairing methods
  "device.pair.list": async ({ respond }) => {
    // Return { pending: [], paired: [] } to match expected pairing list format
    respond(true, { pending: [], paired: [] }, undefined);
  },
  "device.pair.approve": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "device.pair.reject": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "device.token.rotate": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "device.token.revoke": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },

  // Node management methods
  "node.rename": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },

  "node.list": async ({ params, respond, context }) => {
    if (!validateNodeListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid node.list params: ${formatValidationErrors(validateNodeListParams.errors)}`,
        ),
      );
      return;
    }
    const connected = context.nodeRegistry.listConnected();
    const nodes = connected.map((n) => ({
      nodeId: n.nodeId,
      displayName: n.displayName,
      platform: n.platform,
      version: n.version,
      coreVersion: n.coreVersion,
      uiVersion: n.uiVersion,
      deviceFamily: n.deviceFamily,
      modelIdentifier: n.modelIdentifier,
      remoteIp: n.remoteIp,
      caps: n.caps,
      commands: n.commands,
      permissions: n.permissions,
      pathEnv: n.pathEnv,
      connectedAtMs: n.connectedAtMs,
      connected: true,
      paired: true,
    }));
    respond(true, { ts: Date.now(), nodes }, undefined);
  },

  "node.describe": async ({ params, respond, context }) => {
    if (!validateNodeDescribeParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid node.describe params: ${formatValidationErrors(validateNodeDescribeParams.errors)}`,
        ),
      );
      return;
    }
    const nodeId = (params as { nodeId: string }).nodeId;
    const node = context.nodeRegistry.get(nodeId);
    if (!node) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown nodeId"));
      return;
    }
    respond(
      true,
      {
        ts: Date.now(),
        nodeId: node.nodeId,
        displayName: node.displayName,
        platform: node.platform,
        version: node.version,
        coreVersion: node.coreVersion,
        uiVersion: node.uiVersion,
        deviceFamily: node.deviceFamily,
        modelIdentifier: node.modelIdentifier,
        remoteIp: node.remoteIp,
        caps: node.caps,
        commands: node.commands,
        permissions: node.permissions,
        pathEnv: node.pathEnv,
        connectedAtMs: node.connectedAtMs,
        connected: true,
        paired: true,
      },
      undefined,
    );
  },

  "node.invoke": async ({ params, respond, client, context }) => {
    if (!validateNodeInvokeParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid node.invoke params: ${formatValidationErrors(validateNodeInvokeParams.errors)}`,
        ),
      );
      return;
    }
    const { nodeId, command, timeoutMs, idempotencyKey } = params as {
      nodeId: string;
      command: string;
      params?: unknown;
      timeoutMs?: number;
      idempotencyKey: string;
    };
    const rawInvokeParams = (params as { params?: unknown }).params;

    const node = context.nodeRegistry.get(nodeId);
    if (!node) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "node not connected"));
      return;
    }

    const cfg = loadConfig();
    const allowlist = resolveNodeCommandAllowlist(cfg, node);
    const check = isNodeCommandAllowed({
      command,
      declaredCommands: node.commands,
      allowlist,
    });
    if (!check.ok) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `node command not allowed: ${check.reason}`),
      );
      return;
    }

    // Sanitize params: for system.run, validate exec approval device binding
    // and apply the defensive param allowlist.
    const sanitized = sanitizeNodeInvokeParamsFromApproval({
      command,
      rawParams: rawInvokeParams,
      client,
      execApprovalManager: context.execApprovalManager,
    });
    if (!sanitized.ok) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, sanitized.message, {
          details: sanitized.details ?? null,
        }),
      );
      return;
    }

    // Block commands that require exec approval if no valid approval was
    // provided.  The sanitizer strips client-supplied `approved` so we check
    // the sanitized output.
    if (requiresExecApproval(command)) {
      const sp = sanitized.params as Record<string, unknown>;
      if (sp.approved !== true) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "exec approval required for this command", {
            details: { code: "EXEC_APPROVAL_REQUIRED", command },
          }),
        );
        return;
      }
    }

    const result = await context.nodeRegistry.invoke({
      nodeId,
      command,
      params: sanitized.params,
      timeoutMs,
      idempotencyKey,
    });

    if (!result.ok) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, result.error?.message ?? "node invoke failed"),
      );
      return;
    }

    const payload = result.payloadJSON ? safeParseJson(result.payloadJSON) : result.payload;
    respond(true, { ok: true, nodeId, command, payload }, undefined);
  },

  "node.invoke.result": async ({ params, respond, context, client }) => {
    // Normalize payloadJSON: if null is sent as a value, convert to undefined
    const raw: Record<string, unknown> = params;
    if ("payloadJSON" in raw && raw.payloadJSON === null) {
      delete raw.payloadJSON;
    }

    if (!validateNodeInvokeResultParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid node.invoke.result params: ${formatValidationErrors(validateNodeInvokeResultParams.errors)}`,
        ),
      );
      return;
    }
    const { id, nodeId, ok, payload, payloadJSON, error } = params as {
      id: string;
      nodeId: string;
      ok: boolean;
      payload?: unknown;
      payloadJSON?: string;
      error?: { code?: string; message?: string };
    };

    // Security: if the caller is a node, it must match the nodeId
    const callerNodeId = client?.connect?.device?.id ?? client?.connect?.client?.id;
    if (client?.connect?.role === "node" && callerNodeId && callerNodeId !== nodeId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "nodeId mismatch"));
      return;
    }

    const handled = context.nodeRegistry.handleInvokeResult({
      id,
      nodeId,
      ok,
      payload,
      payloadJSON: payloadJSON ?? null,
      error: error ?? null,
    });

    // Late-arriving invoke results are silently accepted to reduce log noise.
    respond(true, { ok: true, ignored: !handled }, undefined);
  },

  "node.event": async ({ params, respond, client }) => {
    if (!validateNodeEventParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid node.event params: ${formatValidationErrors(validateNodeEventParams.errors)}`,
        ),
      );
      return;
    }
    // node.event is handled but requires node role (enforced by auth layer)
    const callerNodeId = client?.connect?.device?.id ?? client?.connect?.client?.id ?? "node";
    const { event } = params as { event: string; payload?: unknown; payloadJSON?: string };
    void callerNodeId;
    void event;
    respond(true, { ok: true }, undefined);
  },
};
