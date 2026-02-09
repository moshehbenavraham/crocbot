import type { IncomingMessage, ServerResponse } from "node:http";

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import type { McpServerModeConfig } from "./types.js";
import { authenticateMcpRequest } from "./server-auth.js";

type LogFn = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

/**
 * Active SSE transport sessions keyed by session ID.
 * Cleaned up when the SSE connection closes.
 */
const sseSessions = new Map<string, SSEServerTransport>();

/**
 * Create the unified MCP server HTTP request handler.
 *
 * Returns a function with signature `(req, res) => Promise<boolean>` that
 * matches the gateway handler chain pattern. Returns `true` when the request
 * was handled (even if rejected), `false` when the path does not match.
 *
 * The `serverFactory` option creates a fresh MCP Server per stateless HTTP
 * request. The SDK Server class only allows one active transport, so each
 * HTTP POST needs its own Server instance. SSE reuses the shared `server`.
 */
export function createMcpServerHandler(opts: {
  server: Server;
  config: McpServerModeConfig;
  log: LogFn;
  serverFactory?: () => Server;
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const { server, config, log, serverFactory } = opts;
  const basePath = config.basePath;

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // Only handle requests under the configured basePath.
    if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
      return false;
    }

    // Authenticate all MCP requests.
    if (!authenticateMcpRequest(req, config.token)) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Unauthorized");
      return true;
    }

    const subPath = pathname.slice(basePath.length).replace(/^\/+/, "");

    // SSE transport: GET /mcp/sse establishes the stream
    if (subPath === "sse" && req.method === "GET") {
      return handleSseConnect(server, basePath, req, res, log);
    }

    // SSE transport: POST /mcp/messages for client-to-server messages
    if (subPath === "messages" && req.method === "POST") {
      return handleSseMessage(req, res, log);
    }

    // Streamable HTTP transport: POST /mcp/http
    if (subPath === "http" && req.method === "POST") {
      // Each stateless HTTP request needs its own Server instance because
      // the SDK Server class only allows one active transport connection.
      const httpServer = serverFactory ? serverFactory() : server;
      return handleStreamableHttp(httpServer, req, res, log);
    }

    // Unknown sub-path under basePath.
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  };
}

// -- SSE Transport -----------------------------------------------------------

async function handleSseConnect(
  server: Server,
  basePath: string,
  req: IncomingMessage,
  res: ServerResponse,
  log: LogFn,
): Promise<boolean> {
  try {
    const messagesEndpoint = `${basePath}/messages`;
    const transport = new SSEServerTransport(messagesEndpoint, res);
    const sessionId = transport.sessionId;
    sseSessions.set(sessionId, transport);

    log.info(`MCP SSE session connected: ${sessionId}`);

    // Clean up on disconnect.
    res.on("close", () => {
      sseSessions.delete(sessionId);
      log.info(`MCP SSE session disconnected: ${sessionId}`);
      void transport.close().catch(() => {});
    });

    await server.connect(transport);
    return true;
  } catch (err) {
    log.error(`MCP SSE connect error: ${String(err)}`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    }
    return true;
  }
}

async function handleSseMessage(
  req: IncomingMessage,
  res: ServerResponse,
  log: LogFn,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const transport = sseSessions.get(sessionId);

  if (!transport) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Unknown or expired session");
    return true;
  }

  try {
    await transport.handlePostMessage(req, res);
    return true;
  } catch (err) {
    log.error(`MCP SSE message error: ${String(err)}`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    }
    return true;
  }
}

// -- Streamable HTTP Transport -----------------------------------------------

async function handleStreamableHttp(
  server: Server,
  req: IncomingMessage,
  res: ServerResponse,
  log: LogFn,
): Promise<boolean> {
  try {
    // Stateless mode: each request gets a fresh transport.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Connect server for this request, then handle the request.
    await server.connect(transport);

    // Read the request body as JSON.
    const body = await readJsonBody(req);
    await transport.handleRequest(req, res, body);
    return true;
  } catch (err) {
    log.error(`MCP HTTP transport error: ${String(err)}`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    }
    return true;
  }
}

// -- Helpers -----------------------------------------------------------------

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const maxBytes = 1024 * 1024; // 1 MB

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

// Exported for testing only.
export function _getSseSessions(): Map<string, SSEServerTransport> {
  return sseSessions;
}
