import { DEFAULT_MCP_SERVER_BASE_PATH, DEFAULT_TOOL_TIMEOUT_MS } from "./types.js";
import type {
  McpGlobalConfig,
  McpServerConfig,
  McpServerModeConfig,
  McpTransportType,
} from "./types.js";

const VALID_TRANSPORT_TYPES = new Set<McpTransportType>(["stdio", "sse", "http"]);

/**
 * Validate and normalize a raw MCP configuration object.
 *
 * Enforces required fields per transport type, applies default timeouts,
 * and filters out disabled servers.
 */
export function loadMcpConfig(raw: unknown): McpGlobalConfig {
  if (raw == null || typeof raw !== "object") {
    return { servers: {} };
  }

  const obj = raw as Record<string, unknown>;
  const rawServers = obj.servers;
  if (rawServers == null || typeof rawServers !== "object") {
    return { servers: {} };
  }

  const servers: Record<string, McpServerConfig> = {};

  for (const [name, value] of Object.entries(rawServers as Record<string, unknown>)) {
    if (value == null || typeof value !== "object") {
      throw new Error(`MCP server "${name}": config must be an object`);
    }

    const entry = value as Record<string, unknown>;
    const type = (entry.type as string) ?? "stdio";

    if (!VALID_TRANSPORT_TYPES.has(type as McpTransportType)) {
      throw new Error(`MCP server "${name}": unknown transport type "${type}"`);
    }

    // Skip disabled servers
    if (entry.disabled === true) {
      continue;
    }

    validateRequiredFields(name, type as McpTransportType, entry);

    const headers = parseHeaders(name, entry.headers);

    servers[name] = {
      type: type as McpTransportType,
      timeout: typeof entry.timeout === "number" ? entry.timeout : DEFAULT_TOOL_TIMEOUT_MS,
      command: typeof entry.command === "string" ? entry.command : undefined,
      args: Array.isArray(entry.args) ? (entry.args as string[]) : undefined,
      env: isStringRecord(entry.env) ? entry.env : undefined,
      url: typeof entry.url === "string" ? entry.url : undefined,
      headers,
    };
  }

  return { servers };
}

function validateRequiredFields(
  name: string,
  type: McpTransportType,
  entry: Record<string, unknown>,
): void {
  if (type === "stdio") {
    if (typeof entry.command !== "string" || entry.command.length === 0) {
      throw new Error(`MCP server "${name}": stdio transport requires a "command" field`);
    }
  }

  if (type === "sse" || type === "http") {
    if (typeof entry.url !== "string" || entry.url.length === 0) {
      throw new Error(`MCP server "${name}": ${type} transport requires a "url" field`);
    }
  }
}

function parseHeaders(name: string, value: unknown): Record<string, string> | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`MCP server "${name}": "headers" must be an object with string values`);
  }
  const record = value as Record<string, unknown>;
  for (const [key, val] of Object.entries(record)) {
    if (typeof val !== "string") {
      throw new Error(`MCP server "${name}": header "${key}" must be a string value`);
    }
  }
  return record as Record<string, string>;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (value == null || typeof value !== "object") {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");
}

/**
 * Validate and normalize the `mcp.server` configuration section.
 *
 * Returns `null` when the server section is absent or `enabled` is `false`.
 * Throws when `enabled` is `true` but `token` is missing.
 */
export function loadMcpServerConfig(raw: unknown): McpServerModeConfig | null {
  if (raw == null || typeof raw !== "object") {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const serverRaw = obj.server;
  if (serverRaw == null || typeof serverRaw !== "object") {
    return null;
  }

  const section = serverRaw as Record<string, unknown>;
  const enabled = section.enabled === true;
  if (!enabled) {
    return null;
  }

  const token = typeof section.token === "string" ? section.token.trim() : "";
  if (!token) {
    throw new Error("MCP server mode requires a token: set mcp.server.token in your config");
  }

  const rawBasePath = typeof section.basePath === "string" ? section.basePath.trim() : "";
  let basePath = rawBasePath || DEFAULT_MCP_SERVER_BASE_PATH;
  // Ensure basePath starts with "/" and has no trailing slash.
  if (!basePath.startsWith("/")) {
    basePath = `/${basePath}`;
  }
  basePath = basePath.replace(/\/+$/, "") || "/";

  return { enabled: true, token, basePath };
}
