import type { IncomingMessage, ServerResponse } from "node:http";

import { readConfigFileSnapshot, redactConfigSnapshot } from "../config/config.js";
import { authorizeGatewayConnect, type ResolvedGatewayAuth } from "./auth.js";
import { sendJson, sendMethodNotAllowed, sendUnauthorized } from "./http-common.js";
import { getBearerToken } from "./http-utils.js";

/**
 * Handles GET /setup/export — returns a redacted configuration snapshot
 * for backup purposes. Requires Bearer token authentication.
 */
export async function handleSetupHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { auth: ResolvedGatewayAuth; trustedProxies?: string[] },
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname !== "/setup/export") {
    return false;
  }

  if (req.method !== "GET") {
    sendMethodNotAllowed(res, "GET");
    return true;
  }

  const token = getBearerToken(req);
  const authResult = await authorizeGatewayConnect({
    auth: opts.auth,
    connectAuth: token ? { token, password: token } : null,
    req,
    trustedProxies: opts.trustedProxies,
  });
  if (!authResult.ok) {
    sendUnauthorized(res);
    return true;
  }

  const snapshot = await readConfigFileSnapshot();
  const redacted = redactConfigSnapshot(snapshot);

  sendJson(res, 200, {
    path: redacted.path,
    exists: redacted.exists,
    valid: redacted.valid,
    config: redacted.config,
    hash: redacted.hash,
    exportedAt: new Date().toISOString(),
  });
  return true;
}
