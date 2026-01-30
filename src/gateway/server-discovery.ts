import { getTailnetHostname } from "../infra/tailscale.js";
import { runExec } from "../process/exec.js";

export function formatInstanceName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "crocbot";
  if (/crocbot/i.test(trimmed)) return trimmed;
  return `${trimmed} (crocbot)`;
}

export async function resolveTailnetDnsHint(opts?: {
  env?: NodeJS.ProcessEnv;
  exec?: typeof runExec;
  enabled?: boolean;
}): Promise<string | undefined> {
  const env = opts?.env ?? process.env;
  const envRaw = env.CROCBOT_TAILNET_DNS?.trim();
  const envValue = envRaw && envRaw.length > 0 ? envRaw.replace(/\.$/, "") : "";
  if (envValue) return envValue;
  if (opts?.enabled === false) return undefined;

  const exec =
    opts?.exec ??
    ((command, args) => runExec(command, args, { timeoutMs: 1500, maxBuffer: 200_000 }));
  try {
    return await getTailnetHostname(exec);
  } catch {
    return undefined;
  }
}
