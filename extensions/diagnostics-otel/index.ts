import type { crocbotPluginApi } from "crocbot/plugin-sdk";
import { emptyPluginConfigSchema } from "crocbot/plugin-sdk";

import { createDiagnosticsOtelService } from "./src/service.js";

const plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: emptyPluginConfigSchema(),
  register(api: crocbotPluginApi) {
    api.registerService(createDiagnosticsOtelService());
  },
};

export default plugin;
