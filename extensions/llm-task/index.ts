import type { crocbotPluginApi } from "../../src/plugins/types.js";

import { createLlmTaskTool } from "./src/llm-task-tool.js";

export default function register(api: crocbotPluginApi) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
