import { callGateway } from "../../gateway/call.js";
import { isBlockedHostname, isPrivateIpAddress } from "../../infra/net/ssrf.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../../utils/message-channel.js";

export const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";

export type GatewayCallOptions = {
  gatewayUrl?: string;
  gatewayToken?: string;
  timeoutMs?: number;
};

export function validateGatewayUrl(url: string): void {
  if (url === DEFAULT_GATEWAY_URL) {
    return;
  }
  let parsed: URL;
  try {
    // Normalize ws/wss to http/https for URL parsing
    const normalized = url.replace(/^ws(s?):\/\//, "http$1://");
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Gateway URL invalid: ${url}`);
  }
  if (isPrivateIpAddress(parsed.hostname)) {
    throw new Error(`Gateway URL blocked: private/internal address: ${url}`);
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`Gateway URL blocked: restricted hostname: ${url}`);
  }
}

export function resolveGatewayOptions(opts?: GatewayCallOptions) {
  // Prefer an explicit override; otherwise let callGateway choose based on config.
  const url =
    typeof opts?.gatewayUrl === "string" && opts.gatewayUrl.trim()
      ? opts.gatewayUrl.trim()
      : undefined;
  if (url) {
    validateGatewayUrl(url);
  }
  const token =
    typeof opts?.gatewayToken === "string" && opts.gatewayToken.trim()
      ? opts.gatewayToken.trim()
      : undefined;
  const timeoutMs =
    typeof opts?.timeoutMs === "number" && Number.isFinite(opts.timeoutMs)
      ? Math.max(1, Math.floor(opts.timeoutMs))
      : 30_000;
  return { url, token, timeoutMs };
}

export async function callGatewayTool<T = unknown>(
  method: string,
  opts: GatewayCallOptions,
  params?: unknown,
  extra?: { expectFinal?: boolean },
) {
  const gateway = resolveGatewayOptions(opts);
  return await callGateway<T>({
    url: gateway.url,
    token: gateway.token,
    method,
    params,
    timeoutMs: gateway.timeoutMs,
    expectFinal: extra?.expectFinal,
    clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
    clientDisplayName: "agent",
    mode: GATEWAY_CLIENT_MODES.BACKEND,
  });
}
