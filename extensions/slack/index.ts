import type { crocbotPluginApi } from "crocbot/plugin-sdk";
import { emptyPluginConfigSchema } from "crocbot/plugin-sdk";
import { slackPlugin } from "./src/channel.js";
import { setSlackRuntime } from "./src/runtime.js";

const plugin = {
  id: "slack",
  name: "Slack (Read-Only)",
  description: "Slack read-only channel plugin — receives messages, never writes back",
  configSchema: emptyPluginConfigSchema(),
  register(api: crocbotPluginApi) {
    setSlackRuntime(api.runtime);
    api.registerChannel({ plugin: slackPlugin });
  },
};

export default plugin;
