import type { Command } from "commander";

import { registerKnowledgeCli } from "../knowledge-cli.js";

export function registerKnowledgeCommand(program: Command): void {
  registerKnowledgeCli(program);
}
