import { pickPrimaryTailnetIPv4, pickPrimaryTailnetIPv6 } from "../infra/tailnet.js";
import { WIDE_AREA_DISCOVERY_DOMAIN, writeWideAreaGatewayZone } from "../infra/widearea-dns.js";
import { formatInstanceName, resolveTailnetDnsHint } from "./server-discovery.js";

export async function startGatewayDiscovery(params: {
  machineDisplayName: string;
  port: number;
  gatewayTls?: { enabled: boolean; fingerprintSha256?: string };
  canvasPort?: number;
  wideAreaDiscoveryEnabled: boolean;
  tailscaleMode: "off" | "serve" | "funnel";
  logDiscovery: { info: (msg: string) => void; warn: (msg: string) => void };
}) {
  const tailscaleEnabled = params.tailscaleMode !== "off";
  const needsTailnetDns = params.wideAreaDiscoveryEnabled;
  const tailnetDns = needsTailnetDns
    ? await resolveTailnetDnsHint({ enabled: tailscaleEnabled })
    : undefined;
  const sshPortEnv = process.env.CROCBOT_SSH_PORT?.trim();
  const sshPortParsed = sshPortEnv ? Number.parseInt(sshPortEnv, 10) : NaN;
  const sshPort = Number.isFinite(sshPortParsed) && sshPortParsed > 0 ? sshPortParsed : undefined;

  if (params.wideAreaDiscoveryEnabled) {
    const tailnetIPv4 = pickPrimaryTailnetIPv4();
    if (!tailnetIPv4) {
      params.logDiscovery.warn(
        "discovery.wideArea.enabled is true, but no Tailscale IPv4 address was found; skipping unicast DNS-SD zone update",
      );
    } else {
      try {
        const tailnetIPv6 = pickPrimaryTailnetIPv6();
        const result = await writeWideAreaGatewayZone({
          gatewayPort: params.port,
          displayName: formatInstanceName(params.machineDisplayName),
          tailnetIPv4,
          tailnetIPv6: tailnetIPv6 ?? undefined,
          gatewayTlsEnabled: params.gatewayTls?.enabled ?? false,
          gatewayTlsFingerprintSha256: params.gatewayTls?.fingerprintSha256,
          tailnetDns,
          sshPort,
        });
        params.logDiscovery.info(
          `wide-area DNS-SD ${result.changed ? "updated" : "unchanged"} (${WIDE_AREA_DISCOVERY_DOMAIN} -> ${result.zonePath})`,
        );
      } catch (err) {
        params.logDiscovery.warn(`wide-area discovery update failed: ${String(err)}`);
      }
    }
  }

  return {};
}
