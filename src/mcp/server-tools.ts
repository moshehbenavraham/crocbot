import { randomUUID } from "node:crypto";

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import type { crocbotConfig } from "../config/config.js";

/** Dependencies injected into MCP server tool handlers for testability. */
export interface ServerDeps {
  /** Dispatch a chat message and return the assistant response text. */
  dispatchChat: (params: { message: string; sessionKey: string; runId: string }) => Promise<string>;
  /** Search memory and return matching results. */
  searchMemory: (params: { query: string; limit?: number }) => Promise<MemorySearchResultItem[]>;
  /** Return current config snapshot. */
  getConfig: () => crocbotConfig;
}

/** A single memory search result returned from `query_memory`. */
export interface MemorySearchResultItem {
  path: string;
  snippet: string;
  score: number;
}

// -- Tool definitions --------------------------------------------------------

const TOOLS = [
  {
    name: "send_message",
    description:
      "Send a message to crocbot and receive the assistant response. " +
      "Optionally pass a chat_id to continue an existing conversation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "The message to send" },
        chat_id: {
          type: "string",
          description: "Optional chat session ID for conversation continuity",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "finish_chat",
    description:
      "End a persistent chat session started by send_message. " +
      "The chat_id will no longer be valid after this call.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chat_id: { type: "string", description: "The chat session ID to close" },
      },
      required: ["chat_id"],
    },
  },
  {
    name: "query_memory",
    description:
      "Search crocbot's memory store for relevant information. " +
      "Returns matching memory snippets sorted by relevance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query" },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_capabilities",
    description:
      "List crocbot's current capabilities, active model configuration, " +
      "memory status, and available features.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// -- Active chat sessions for conversation continuity ------------------------

const activeChatSessions = new Map<string, string>();

/**
 * Register tool list and call handlers on the given MCP Server instance.
 */
export function registerServerTools(server: Server, deps: ServerDeps): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "send_message":
        return handleSendMessage(deps, args);
      case "finish_chat":
        return handleFinishChat(args);
      case "query_memory":
        return handleQueryMemory(deps, args);
      case "list_capabilities":
        return handleListCapabilities(deps);
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });
}

// -- Tool handlers -----------------------------------------------------------

async function handleSendMessage(
  deps: ServerDeps,
  args: Record<string, unknown> | undefined,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const message = typeof args?.message === "string" ? args.message.trim() : "";
  if (!message) {
    return {
      content: [{ type: "text", text: "message is required" }],
      isError: true,
    };
  }

  const chatId = typeof args?.chat_id === "string" ? args.chat_id.trim() : "";
  let sessionKey: string;

  if (chatId && activeChatSessions.has(chatId)) {
    sessionKey = activeChatSessions.get(chatId)!;
  } else {
    const newChatId = chatId || randomUUID();
    sessionKey = `mcp-server:${newChatId}`;
    activeChatSessions.set(newChatId, sessionKey);
  }

  const resolvedChatId =
    chatId || [...activeChatSessions.entries()].find(([, v]) => v === sessionKey)?.[0] || "";
  const runId = `mcp_${randomUUID()}`;

  try {
    const response = await deps.dispatchChat({ message, sessionKey, runId });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ chat_id: resolvedChatId, response }),
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Chat error: ${String(err)}` }],
      isError: true,
    };
  }
}

async function handleFinishChat(
  args: Record<string, unknown> | undefined,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const chatId = typeof args?.chat_id === "string" ? args.chat_id.trim() : "";
  if (!chatId) {
    return {
      content: [{ type: "text", text: "chat_id is required" }],
      isError: true,
    };
  }

  if (!activeChatSessions.has(chatId)) {
    return {
      content: [{ type: "text", text: `Unknown chat_id: ${chatId}` }],
      isError: true,
    };
  }

  activeChatSessions.delete(chatId);
  return {
    content: [{ type: "text", text: JSON.stringify({ chat_id: chatId, status: "closed" }) }],
  };
}

async function handleQueryMemory(
  deps: ServerDeps,
  args: Record<string, unknown> | undefined,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const query = typeof args?.query === "string" ? args.query.trim() : "";
  if (!query) {
    return {
      content: [{ type: "text", text: "query is required" }],
      isError: true,
    };
  }

  const limit = typeof args?.limit === "number" && args.limit > 0 ? Math.floor(args.limit) : 5;

  try {
    const results = await deps.searchMemory({ query, limit });
    return {
      content: [{ type: "text", text: JSON.stringify({ results, total: results.length }) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Memory search error: ${String(err)}` }],
      isError: true,
    };
  }
}

async function handleListCapabilities(
  deps: ServerDeps,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const cfg = deps.getConfig();
    const capabilities = {
      tools: TOOLS.map((t) => t.name),
      model: cfg.agents?.defaults?.model ?? null,
      memory: Boolean(cfg.memory),
      mcpClientEnabled: Boolean(cfg.mcp && Object.keys(cfg.mcp).length > 0),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(capabilities) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error listing capabilities: ${String(err)}` }],
    };
  }
}

// Exported for testing only.
export function _getActiveChatSessions(): Map<string, string> {
  return activeChatSessions;
}
