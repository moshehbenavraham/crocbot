import { DEFAULT_TOOL_TIMEOUT_MS } from "./types.js";
import type { McpGlobalConfig, McpServerConfig, McpTransportType } from "./types.js";

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

    servers[name] = {
      type: type as McpTransportType,
      timeout: typeof entry.timeout === "number" ? entry.timeout : DEFAULT_TOOL_TIMEOUT_MS,
      command: typeof entry.command === "string" ? entry.command : undefined,
      args: Array.isArray(entry.args) ? (entry.args as string[]) : undefined,
      env: isStringRecord(entry.env) ? entry.env : undefined,
      url: typeof entry.url === "string" ? entry.url : undefined,
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

function isStringRecord(value: unknown): value is Record<string, string> {
  if (value == null || typeof value !== "object") {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");
}
