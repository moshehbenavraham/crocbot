#!/usr/bin/env node
// Minimal MCP test server for E2E testing.
// Tools: echo, add, slow-response.
// Runs over stdio transport -- no build step required.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const TOOLS = [
  {
    name: "echo",
    description: "Echo the input message back",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to echo" },
      },
      required: ["message"],
    },
  },
  {
    name: "add",
    description: "Add two numbers together",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "slow-response",
    description: "Respond after a configurable delay (for timeout testing)",
    inputSchema: {
      type: "object",
      properties: {
        delay_ms: {
          type: "number",
          description: "Delay in milliseconds before responding",
        },
      },
      required: ["delay_ms"],
    },
  },
];

const server = new Server(
  { name: "mcp-test-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "echo": {
      const raw = args?.message;
      const message = typeof raw === "string" ? raw : "";
      return {
        content: [{ type: "text", text: message }],
      };
    }
    case "add": {
      const a = Number(args?.a ?? 0);
      const b = Number(args?.b ?? 0);
      return {
        content: [{ type: "text", text: String(a + b) }],
      };
    }
    case "slow-response": {
      const delayMs = Number(args?.delay_ms ?? 1000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return {
        content: [{ type: "text", text: `responded after ${delayMs}ms` }],
      };
    }
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

// Signal readiness to the parent process.
process.stderr.write("MCP_TEST_SERVER_READY\n");
