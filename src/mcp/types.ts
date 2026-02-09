import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Connection state machine for a managed MCP server. */
export enum McpClientState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Error = "error",
}

/** Transport type for an MCP server connection. */
export type McpTransportType = "stdio" | "sse" | "http";

/** Configuration for a single MCP server. */
export interface McpServerConfig {
  /** Transport type. */
  type: McpTransportType;
  /** Whether this server is disabled (skipped during connect). */
  disabled?: boolean;
  /** Tool call timeout in milliseconds (default: 60000). */
  timeout?: number;

  // stdio-specific fields
  /** Command to spawn for stdio transport. */
  command?: string;
  /** Arguments for the stdio command. */
  args?: string[];
  /** Environment variables for the stdio process. */
  env?: Record<string, string>;

  // HTTP/SSE-specific fields
  /** URL for HTTP or SSE transport. */
  url?: string;
  /** Custom HTTP headers for remote transports (Bearer tokens, API keys). */
  headers?: Record<string, string>;
}

/** Top-level MCP configuration from crocbot.json "mcp" section. */
export interface McpGlobalConfig {
  /** Map of server name to server configuration. */
  servers: Record<string, McpServerConfig>;
}

/** Metadata for a single MCP tool. */
export interface McpToolInfo {
  /** Tool name as reported by the server. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** JSON Schema for tool input parameters. */
  inputSchema: Record<string, unknown>;
}

/** Internal state for a managed MCP server connection. */
export interface ManagedServer {
  /** Server name (key from config). */
  name: string;
  /** Server configuration. */
  config: McpServerConfig;
  /** Current connection state. */
  state: McpClientState;
  /** SDK Client instance (null when disconnected). */
  client: Client | null;
  /** Active transport (null when disconnected). */
  transport: Transport | null;
  /** Cached tool list (null until first listTools call). */
  tools: McpToolInfo[] | null;
  /** Last connection error (null when healthy). */
  lastError: Error | null;
}

/** Status snapshot for a single server (returned by getStatus). */
export interface McpServerStatus {
  name: string;
  state: McpClientState;
  toolCount: number;
  lastError: string | null;
}

/** Default tool call timeout in milliseconds. */
export const DEFAULT_TOOL_TIMEOUT_MS = 60_000;

/** Default MCP server base path. */
export const DEFAULT_MCP_SERVER_BASE_PATH = "/mcp";

/** Configuration for crocbot's MCP server mode. */
export interface McpServerModeConfig {
  /** Whether the MCP server is enabled (default: false). */
  enabled: boolean;
  /** Bearer token for authenticating inbound MCP requests. Required when enabled. */
  token: string;
  /** Base path for MCP server HTTP endpoints (default: "/mcp"). */
  basePath: string;
}

// Re-export SDK types used by consumers
export type { Tool as McpSdkTool, CallToolResult as McpCallToolResult };
