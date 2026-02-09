import { Type } from "@sinclair/typebox";

import type { AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AnyAgentTool } from "../agents/tools/common.js";
import { SecretsRegistry } from "../infra/secrets/registry.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { McpClientManager } from "./client.js";
import { McpToolError } from "./errors.js";
import { McpClientState } from "./types.js";
import type { McpToolInfo } from "./types.js";

const log = createSubsystemLogger("mcp/tool-bridge");

/**
 * Wrap a single MCP tool as an AnyAgentTool.
 *
 * Converts the MCP tool metadata into the AgentTool interface expected by
 * the pi-agent-core engine, including schema wrapping via Type.Unsafe()
 * and execute delegation to McpClientManager.callTool().
 */
export function wrapMcpTool(
  manager: McpClientManager,
  serverName: string,
  tool: McpToolInfo,
): AnyAgentTool {
  const qualifiedName = `${serverName}.${tool.name}`;
  const parameters = Type.Unsafe(tool.inputSchema);

  return {
    name: qualifiedName,
    description: tool.description || `MCP tool: ${qualifiedName}`,
    parameters,
    label: `MCP: ${serverName}/${tool.name}`,

    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
    ): Promise<AgentToolResult<unknown>> {
      const registry = SecretsRegistry.getInstance();
      const maskText = registry.size > 0 ? (t: string) => registry.mask(t) : (t: string) => t;

      try {
        const result = await manager.callTool(serverName, tool.name, params);
        const content: AgentToolResult<unknown>["content"] = [];

        if (result.content && Array.isArray(result.content)) {
          for (const entry of result.content) {
            if (entry.type === "text" && typeof entry.text === "string") {
              content.push({ type: "text", text: maskText(entry.text) });
            } else if (
              entry.type === "image" &&
              typeof entry.data === "string" &&
              typeof entry.mimeType === "string"
            ) {
              content.push({
                type: "image",
                data: entry.data,
                mimeType: entry.mimeType,
              });
            }
          }
        }

        if (content.length === 0) {
          content.push({ type: "text", text: "" });
        }

        return { content, details: { serverName, toolName: tool.name } };
      } catch (err) {
        const message =
          err instanceof McpToolError
            ? err.isTimeout
              ? `MCP tool "${qualifiedName}" timed out: ${err.message}`
              : `MCP tool "${qualifiedName}" failed: ${err.message}`
            : `MCP tool "${qualifiedName}" failed: ${err instanceof Error ? err.message : String(err)}`;

        log.error(message);

        return {
          content: [{ type: "text", text: maskText(message) }],
          details: {
            serverName,
            toolName: tool.name,
            error: true,
            isTimeout: err instanceof McpToolError ? err.isTimeout : false,
          },
        };
      }
    },
  };
}

/**
 * Resolve all MCP tools from connected servers, wrapping them as AnyAgentTool[].
 *
 * Iterates all connected servers in the manager, fetches their tool lists,
 * wraps each tool, and checks for name collisions against both the
 * existing tool set and other MCP tools.
 *
 * Colliding MCP tools are skipped with a warning log.
 */
export async function resolveMcpTools(
  manager: McpClientManager,
  existingNames: Set<string>,
): Promise<AnyAgentTool[]> {
  const tools: AnyAgentTool[] = [];
  const mcpNames = new Set<string>();
  const statuses = manager.getStatus();

  for (const status of statuses) {
    if (status.state !== McpClientState.Connected) {
      continue;
    }

    let serverTools: McpToolInfo[];
    try {
      serverTools = await manager.getTools(status.name);
    } catch (err) {
      log.error(
        `Failed to get tools from MCP server "${status.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    for (const mcpTool of serverTools) {
      const qualifiedName = `${status.name}.${mcpTool.name}`;

      if (existingNames.has(qualifiedName)) {
        log.warn(
          `MCP tool "${qualifiedName}" collides with existing native/plugin tool -- skipping`,
        );
        continue;
      }

      if (mcpNames.has(qualifiedName)) {
        log.warn(
          `MCP tool "${qualifiedName}" collides with another MCP tool -- skipping duplicate`,
        );
        continue;
      }

      mcpNames.add(qualifiedName);
      tools.push(wrapMcpTool(manager, status.name, mcpTool));
    }
  }

  if (tools.length > 0) {
    log.info(`Resolved ${tools.length} MCP tool(s) from ${statuses.length} server(s)`);
  }

  return tools;
}
