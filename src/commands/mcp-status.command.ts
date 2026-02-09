import { loadConfig } from "../config/config.js";
import { McpClientManager } from "../mcp/client.js";
import { loadMcpConfig } from "../mcp/config.js";
import type { McpServerStatus } from "../mcp/types.js";
import type { RuntimeEnv } from "../runtime.js";
import { renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";

export interface McpStatusOpts {
  json: boolean;
}

export async function mcpStatusCommand(opts: McpStatusOpts, runtime: RuntimeEnv): Promise<void> {
  const cfg = loadConfig();
  const mcpConfig = loadMcpConfig(cfg.mcp);

  if (Object.keys(mcpConfig.servers).length === 0) {
    if (opts.json) {
      runtime.log(JSON.stringify({ servers: [] }));
    } else {
      runtime.log("No MCP servers configured.");
    }
    return;
  }

  const manager = new McpClientManager(mcpConfig);
  const serverNames = Object.keys(mcpConfig.servers);

  // Attempt to connect to all servers to get live status.
  await Promise.allSettled(serverNames.map((name) => manager.connect(name)));

  // Fetch tool counts for connected servers.
  for (const name of serverNames) {
    try {
      await manager.getTools(name);
    } catch {
      // Tool fetch failure is reflected in getStatus().
    }
  }

  const statuses: McpServerStatus[] = manager.getStatus();

  // Shutdown connections after probing.
  await manager.shutdown();

  if (opts.json) {
    runtime.log(JSON.stringify({ servers: statuses }, null, 2));
    return;
  }

  runtime.log(`\n${theme.heading("MCP Servers")}\n`);

  const rows = statuses.map((s) => ({
    name: s.name,
    state: formatState(s.state),
    tools: String(s.toolCount),
    error: s.lastError ?? "-",
  }));

  const table = renderTable({
    columns: [
      { key: "name", header: "Server", minWidth: 10 },
      { key: "state", header: "State", minWidth: 12 },
      { key: "tools", header: "Tools", align: "right" as const, minWidth: 7 },
      { key: "error", header: "Last Error", flex: true, minWidth: 10, maxWidth: 60 },
    ],
    rows,
    width: process.stdout.columns || 100,
  });

  runtime.log(table);
}

function formatState(state: string): string {
  switch (state) {
    case "connected":
      return theme.success("connected");
    case "connecting":
      return theme.warn("connecting");
    case "error":
      return theme.error("error");
    case "disconnected":
      return theme.muted("disconnected");
    default:
      return state;
  }
}
