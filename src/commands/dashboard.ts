import { readConfigFileSnapshot, resolveGatewayPort } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveGatewayWsUrl } from "./onboard-helpers.js";

type DashboardOptions = {
  noOpen?: boolean;
};

export async function dashboardCommand(
  runtime: RuntimeEnv = defaultRuntime,
  _options: DashboardOptions = {},
) {
  const snapshot = await readConfigFileSnapshot();
  const cfg = snapshot.valid ? snapshot.config : {};
  const port = resolveGatewayPort(cfg);
  const bind = cfg.gateway?.bind ?? "loopback";
  const customBindHost = cfg.gateway?.customBindHost;

  const wsUrl = resolveGatewayWsUrl({ port, bind, customBindHost });
  runtime.log(`Gateway WS: ${wsUrl}`);
  runtime.log(
    "The browser-based Control UI has been removed. Use the TUI or Telegram to interact with crocbot.",
  );
}
