import type { AgentTool } from "@mariozechner/pi-agent-core";

// oxlint-disable-next-line typescript/no-explicit-any -- TypeBox schema type from pi-agent-core uses a different module instance
export type AnyAgentTool = AgentTool<any, unknown>;
