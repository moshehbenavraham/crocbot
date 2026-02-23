import type { ExecApprovalDecision } from "../../infra/exec-approvals.js";
import type { ExecApprovalForwarder } from "../../infra/exec-approval-forwarder.js";
import type { ExecApprovalManager } from "../exec-approval-manager.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateExecApprovalRequestParams,
  validateExecApprovalResolveParams,
} from "../protocol/index.js";
import type { GatewayClient, GatewayRequestHandlers } from "./types.js";

// -- system.run param sanitization -------------------------------------------

// Defensive allowlist: only forward fields that the node-host system.run
// handler understands.  Prevents internal control fields from being smuggled
// through the gateway.
const SYSTEM_RUN_ALLOWED_KEYS = [
  "command",
  "rawCommand",
  "cwd",
  "env",
  "timeoutMs",
  "needsScreenRecording",
  "agentId",
  "sessionKey",
  "runId",
] as const;

function pickSystemRunParams(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of SYSTEM_RUN_ALLOWED_KEYS) {
    if (key in raw) {
      next[key] = raw[key];
    }
  }
  return next;
}

/**
 * Sanitize system.run params forwarded through node.invoke.
 *
 * - Strips params to the defensive allowlist (prevents field injection).
 * - If `runId` references a pending exec approval, validates device binding
 *   and injects the correct `approved`/`approvalDecision` from the record.
 * - If no `runId` is present, `approved`/`approvalDecision` are omitted so
 *   the node-host treats the command as unapproved.
 */
export function sanitizeSystemRunForForwarding(opts: {
  rawParams: unknown;
  client: GatewayClient | null;
  execApprovalManager: ExecApprovalManager;
}):
  | { ok: true; params: Record<string, unknown> }
  | { ok: false; message: string; details?: Record<string, unknown> } {
  const raw =
    typeof opts.rawParams === "object" && opts.rawParams !== null
      ? (opts.rawParams as Record<string, unknown>)
      : {};

  const sanitized = pickSystemRunParams(raw);
  const runId =
    typeof sanitized.runId === "string" && sanitized.runId.trim() ? sanitized.runId.trim() : null;

  if (!runId) {
    return { ok: true, params: sanitized };
  }

  // Validate device binding for the referenced approval.
  const clientDeviceId = opts.client?.connect?.device?.id ?? null;
  const wsClient = opts.client as unknown as { connId?: string } | null;
  const clientConnId = wsClient?.connId ?? null;
  const binding = opts.execApprovalManager.validateDeviceBinding(
    runId,
    clientDeviceId,
    clientConnId,
  );
  if (!binding.ok) {
    return { ok: false, message: binding.message, details: { code: binding.code, runId } };
  }

  // Override approval fields from the validated record -- client-supplied
  // values are never trusted.
  sanitized.approved = true;
  sanitized.approvalDecision = binding.record.decision ?? "allow-once";

  return { ok: true, params: sanitized };
}

/**
 * Top-level sanitizer for node.invoke params.  Dispatches system.run to the
 * approval-aware sanitizer; other commands pass through unchanged.
 */
export function sanitizeNodeInvokeParams(opts: {
  command: string;
  rawParams: unknown;
  client: GatewayClient | null;
  execApprovalManager: ExecApprovalManager;
}):
  | { ok: true; params: unknown }
  | { ok: false; message: string; details?: Record<string, unknown> } {
  if (opts.command === "system.run") {
    return sanitizeSystemRunForForwarding({
      rawParams: opts.rawParams,
      client: opts.client,
      execApprovalManager: opts.execApprovalManager,
    });
  }
  return { ok: true, params: opts.rawParams };
}

export function createExecApprovalHandlers(
  manager: ExecApprovalManager,
  opts?: { forwarder?: ExecApprovalForwarder },
): GatewayRequestHandlers {
  return {
    "exec.approval.request": async ({ params, respond, client, context }) => {
      if (!validateExecApprovalRequestParams(params)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid exec.approval.request params: ${formatValidationErrors(
              validateExecApprovalRequestParams.errors,
            )}`,
          ),
        );
        return;
      }
      const p = params as {
        id?: string;
        command: string;
        cwd?: string;
        host?: string;
        security?: string;
        ask?: string;
        agentId?: string;
        resolvedPath?: string;
        sessionKey?: string;
        timeoutMs?: number;
      };
      const timeoutMs = typeof p.timeoutMs === "number" ? p.timeoutMs : 120_000;
      const explicitId = typeof p.id === "string" && p.id.trim().length > 0 ? p.id.trim() : null;
      if (explicitId && manager.getSnapshot(explicitId)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "approval id already pending"),
        );
        return;
      }
      const request = {
        command: p.command,
        cwd: p.cwd ?? null,
        host: p.host ?? null,
        security: p.security ?? null,
        ask: p.ask ?? null,
        agentId: p.agentId ?? null,
        resolvedPath: p.resolvedPath ?? null,
        sessionKey: p.sessionKey ?? null,
      };
      const record = manager.create(request, timeoutMs, explicitId);
      // Bind the approval to the requesting client's device identity so
      // other clients cannot replay the approval ID.
      const wsClient = client as unknown as { connId?: string } | null;
      record.requestedByConnId = wsClient?.connId ?? null;
      record.requestedByDeviceId = client?.connect?.device?.id ?? null;
      record.requestedByClientId = client?.connect?.client?.id ?? null;
      const decisionPromise = manager.waitForDecision(record, timeoutMs);
      context.broadcast(
        "exec.approval.requested",
        {
          id: record.id,
          request: record.request,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
        },
        { dropIfSlow: true },
      );
      void opts?.forwarder
        ?.handleRequested({
          id: record.id,
          request: record.request,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
        })
        .catch((err) => {
          context.logGateway?.error?.(`exec approvals: forward request failed: ${String(err)}`);
        });
      const decision = await decisionPromise;
      respond(
        true,
        {
          id: record.id,
          decision,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
        },
        undefined,
      );
    },
    "exec.approval.resolve": async ({ params, respond, client, context }) => {
      if (!validateExecApprovalResolveParams(params)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid exec.approval.resolve params: ${formatValidationErrors(
              validateExecApprovalResolveParams.errors,
            )}`,
          ),
        );
        return;
      }
      const p = params as { id: string; decision: string };
      const decision = p.decision as ExecApprovalDecision;
      if (decision !== "allow-once" && decision !== "allow-always" && decision !== "deny") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid decision"));
        return;
      }
      // Defense-in-depth: prevent self-approval.  The same clientId that
      // requested the approval cannot also resolve it.  This guards against
      // automated clients that might try to approve their own commands.
      const snapshot = manager.getSnapshot(p.id);
      if (snapshot) {
        const resolverClientId = client?.connect?.client?.id ?? null;
        if (
          resolverClientId &&
          snapshot.requestedByClientId &&
          resolverClientId === snapshot.requestedByClientId
        ) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.INVALID_REQUEST, "cannot resolve own exec approval"),
          );
          return;
        }
      }

      const resolvedBy = client?.connect?.client?.displayName ?? client?.connect?.client?.id;
      const ok = manager.resolve(p.id, decision, resolvedBy ?? null);
      if (!ok) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown approval id"));
        return;
      }
      context.broadcast(
        "exec.approval.resolved",
        { id: p.id, decision, resolvedBy, ts: Date.now() },
        { dropIfSlow: true },
      );
      void opts?.forwarder
        ?.handleResolved({ id: p.id, decision, resolvedBy, ts: Date.now() })
        .catch((err) => {
          context.logGateway?.error?.(`exec approvals: forward resolve failed: ${String(err)}`);
        });
      respond(true, { ok: true }, undefined);
    },
  };
}
