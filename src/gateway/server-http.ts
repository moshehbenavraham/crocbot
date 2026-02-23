import {
  createServer as createHttpServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { TlsOptions } from "node:tls";
import type { WebSocketServer } from "ws";
import { loadConfig } from "../config/config.js";
import {
  DEFAULT_WEBHOOK_MAX_BODY_BYTES,
  DEFAULT_WEBHOOK_BODY_TIMEOUT_MS,
  readJsonBodyWithLimit,
} from "../infra/http-body.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import { authorizeGatewayConnect } from "./auth.js";
import { sendUnauthorized } from "./http-common.js";
import { getBearerToken } from "./http-utils.js";
import {
  extractHookToken,
  getHookChannelError,
  type HookMessageChannel,
  type HooksConfigResolved,
  getHookAgentPolicyError,
  isHookAgentAllowed,
  normalizeAgentPayload,
  normalizeHookHeaders,
  normalizeWakePayload,
  readJsonBody,
  resolveHookChannel,
  resolveHookDeliver,
  resolveHookTargetAgentId,
} from "./hooks.js";
import { applyHookMappings } from "./hooks-mapping.js";
import { getMetrics, getMetricsContentType } from "../metrics/index.js";
import { handleOpenAiHttpRequest } from "./openai-http.js";
import type { RateLimiter } from "./rate-limit.js";
import { handleOpenResponsesHttpRequest } from "./openresponses-http.js";
import { applySecurityHeaders, filterRequest } from "./security-headers.js";
import { handleSetupHttpRequest } from "./setup-http.js";
import { handleToolsInvokeHttpRequest } from "./tools-invoke-http.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

type HookDispatchers = {
  dispatchWakeHook: (value: { text: string; mode: "now" | "next-heartbeat" }) => void;
  dispatchAgentHook: (value: {
    message: string;
    name: string;
    agentId?: string;
    wakeMode: "now" | "next-heartbeat";
    sessionKey: string;
    deliver: boolean;
    channel: HookMessageChannel;
    to?: string;
    model?: string;
    thinking?: string;
    timeoutSeconds?: number;
    allowUnsafeExternalContent?: boolean;
  }) => string;
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export type HooksRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export function createHooksRequestHandler(
  opts: {
    getHooksConfig: () => HooksConfigResolved | null;
    bindHost: string;
    port: number;
    logHooks: SubsystemLogger;
  } & HookDispatchers,
): HooksRequestHandler {
  const { getHooksConfig, bindHost, port, logHooks, dispatchAgentHook, dispatchWakeHook } = opts;
  return async (req, res) => {
    const hooksConfig = getHooksConfig();
    if (!hooksConfig) {
      return false;
    }
    const url = new URL(req.url ?? "/", `http://${bindHost}:${port}`);
    const basePath = hooksConfig.basePath;
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
      return false;
    }

    const { token } = extractHookToken(req, url);
    if (!token || token !== hooksConfig.token) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Unauthorized");
      return true;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return true;
    }

    const subPath = url.pathname.slice(basePath.length).replace(/^\/+/, "");
    if (!subPath) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return true;
    }

    const body = await readJsonBody(req, hooksConfig.maxBodyBytes);
    if (!body.ok) {
      const status = body.error === "payload too large" ? 413 : 400;
      sendJson(res, status, { ok: false, error: body.error });
      return true;
    }

    const payload = typeof body.value === "object" && body.value !== null ? body.value : {};
    const headers = normalizeHookHeaders(req);

    if (subPath === "wake") {
      const normalized = normalizeWakePayload(payload as Record<string, unknown>);
      if (!normalized.ok) {
        sendJson(res, 400, { ok: false, error: normalized.error });
        return true;
      }
      dispatchWakeHook(normalized.value);
      sendJson(res, 200, { ok: true, mode: normalized.value.mode });
      return true;
    }

    if (subPath === "agent") {
      const normalized = normalizeAgentPayload(payload as Record<string, unknown>);
      if (!normalized.ok) {
        sendJson(res, 400, { ok: false, error: normalized.error });
        return true;
      }
      if (!isHookAgentAllowed(hooksConfig, normalized.value.agentId)) {
        sendJson(res, 400, { ok: false, error: getHookAgentPolicyError() });
        return true;
      }
      const runId = dispatchAgentHook({
        ...normalized.value,
        agentId: resolveHookTargetAgentId(hooksConfig, normalized.value.agentId),
      });
      sendJson(res, 202, { ok: true, runId });
      return true;
    }

    if (hooksConfig.mappings.length > 0) {
      try {
        const mapped = await applyHookMappings(hooksConfig.mappings, {
          payload: payload as Record<string, unknown>,
          headers,
          url,
          path: subPath,
        });
        if (mapped) {
          if (!mapped.ok) {
            sendJson(res, 400, { ok: false, error: mapped.error });
            return true;
          }
          if (mapped.action === null) {
            res.statusCode = 204;
            res.end();
            return true;
          }
          if (mapped.action.kind === "wake") {
            dispatchWakeHook({
              text: mapped.action.text,
              mode: mapped.action.mode,
            });
            sendJson(res, 200, { ok: true, mode: mapped.action.mode });
            return true;
          }
          if (!isHookAgentAllowed(hooksConfig, mapped.action.agentId)) {
            sendJson(res, 400, { ok: false, error: getHookAgentPolicyError() });
            return true;
          }
          const channel = resolveHookChannel(mapped.action.channel);
          if (!channel) {
            sendJson(res, 400, { ok: false, error: getHookChannelError() });
            return true;
          }
          const runId = dispatchAgentHook({
            message: mapped.action.message,
            name: mapped.action.name ?? "Hook",
            agentId: resolveHookTargetAgentId(hooksConfig, mapped.action.agentId),
            wakeMode: mapped.action.wakeMode,
            sessionKey: mapped.action.sessionKey ?? "",
            deliver: resolveHookDeliver(mapped.action.deliver),
            channel,
            to: mapped.action.to,
            model: mapped.action.model,
            thinking: mapped.action.thinking,
            timeoutSeconds: mapped.action.timeoutSeconds,
            allowUnsafeExternalContent: mapped.action.allowUnsafeExternalContent,
          });
          sendJson(res, 202, { ok: true, runId });
          return true;
        }
      } catch (err) {
        logHooks.warn(`hook mapping failed: ${String(err)}`);
        sendJson(res, 500, { ok: false, error: "hook mapping failed" });
        return true;
      }
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  };
}

export function createGatewayHttpServer(opts: {
  openAiChatCompletionsEnabled: boolean;
  openResponsesEnabled: boolean;
  openResponsesConfig?: import("../config/types.gateway.js").GatewayHttpResponsesConfig;
  handleHooksRequest: HooksRequestHandler;
  handlePluginRequest?: HooksRequestHandler;
  handleMcpServerRequest?: HooksRequestHandler;
  resolvedAuth: import("./auth.js").ResolvedGatewayAuth;
  tlsOptions?: TlsOptions;
  rateLimiter?: RateLimiter;
}): HttpServer {
  const {
    openAiChatCompletionsEnabled,
    openResponsesEnabled,
    openResponsesConfig,
    handleHooksRequest,
    handlePluginRequest,
    handleMcpServerRequest,
    resolvedAuth,
    rateLimiter,
  } = opts;
  const httpServer: HttpServer = opts.tlsOptions
    ? createHttpsServer(opts.tlsOptions, (req, res) => {
        void handleRequest(req, res);
      })
    : createHttpServer((req, res) => {
        void handleRequest(req, res);
      });

  async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    // Don't interfere with WebSocket upgrades; ws handles the 'upgrade' event.
    if (String(req.headers.upgrade ?? "").toLowerCase() === "websocket") {
      return;
    }

    // Security headers on every response
    applySecurityHeaders(res);

    // WAF: reject malformed/malicious requests early
    const filterResult = filterRequest(req);
    if (filterResult.blocked) {
      res.statusCode = filterResult.status ?? 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(filterResult.message ?? "Bad Request");
      return;
    }

    // Lightweight HTTP health endpoint for platform probes (Fly.io, Docker, k8s)
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { status: "healthy" });
      return;
    }

    // Prometheus metrics endpoint for monitoring (no auth, internal use)
    if (req.method === "GET" && req.url === "/metrics") {
      try {
        const metricsOutput = await getMetrics();
        res.statusCode = 200;
        res.setHeader("Content-Type", getMetricsContentType());
        res.end(metricsOutput);
      } catch {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Failed to collect metrics");
      }
      return;
    }

    // Rate limiting (exempt: /health, /metrics above)
    if (rateLimiter) {
      const clientIp = req.socket?.remoteAddress ?? "unknown";
      const result = rateLimiter.check(clientIp);
      res.setHeader("X-RateLimit-Limit", String(result.limit));
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      res.setHeader("X-RateLimit-Reset", String(result.resetAt));
      if (!result.allowed) {
        res.statusCode = 429;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Retry-After", String(result.resetAt - Math.floor(Date.now() / 1000)));
        res.end(JSON.stringify({ error: "Too Many Requests" }));
        return;
      }
    }

    // Alert webhook test endpoint (for testing webhook delivery)
    if (req.method === "POST" && req.url === "/alerts/webhook") {
      try {
        const bodyResult = await readJsonBodyWithLimit(req, {
          maxBytes: DEFAULT_WEBHOOK_MAX_BODY_BYTES,
          timeoutMs: DEFAULT_WEBHOOK_BODY_TIMEOUT_MS,
        });
        if (!bodyResult.ok) {
          sendJson(res, bodyResult.code === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
            error: bodyResult.error,
          });
          return;
        }
        sendJson(res, 200, {
          received: true,
          timestamp: new Date().toISOString(),
          payload: bodyResult.value,
        });
      } catch {
        sendJson(res, 400, { error: "Invalid JSON payload" });
      }
      return;
    }

    try {
      const configSnapshot = loadConfig();
      const trustedProxies = configSnapshot.gateway?.trustedProxies ?? [];
      if (await handleHooksRequest(req, res)) {
        return;
      }
      if (handleMcpServerRequest && (await handleMcpServerRequest(req, res))) {
        return;
      }
      if (
        await handleSetupHttpRequest(req, res, {
          auth: resolvedAuth,
          trustedProxies,
        })
      ) {
        return;
      }
      if (
        await handleToolsInvokeHttpRequest(req, res, {
          auth: resolvedAuth,
          trustedProxies,
        })
      ) {
        return;
      }
      if (handlePluginRequest) {
        // Channel HTTP endpoints are gateway-auth protected by default.
        // Non-channel plugin routes remain plugin-owned and must enforce
        // their own auth when exposing sensitive functionality.
        if ((req.url ?? "").startsWith("/api/channels/")) {
          const token = getBearerToken(req);
          const authResult = await authorizeGatewayConnect({
            auth: resolvedAuth,
            connectAuth: token ? { token, password: token } : null,
            req,
            trustedProxies,
          });
          if (!authResult.ok) {
            sendUnauthorized(res);
            return;
          }
        }
        if (await handlePluginRequest(req, res)) {
          return;
        }
      }
      if (openResponsesEnabled) {
        if (
          await handleOpenResponsesHttpRequest(req, res, {
            auth: resolvedAuth,
            config: openResponsesConfig,
            trustedProxies,
          })
        ) {
          return;
        }
      }
      if (openAiChatCompletionsEnabled) {
        if (
          await handleOpenAiHttpRequest(req, res, {
            auth: resolvedAuth,
            trustedProxies,
          })
        ) {
          return;
        }
      }
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
    } catch {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    }
  }

  return httpServer;
}

export function attachGatewayUpgradeHandler(opts: {
  httpServer: HttpServer;
  wss: WebSocketServer;
}) {
  const { httpServer, wss } = opts;
  httpServer.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
}
