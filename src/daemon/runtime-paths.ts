import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { isSupportedNodeVersion } from "../infra/runtime-guard.js";

const VERSION_MANAGER_MARKERS = [
  "/.nvm/",
  "/.fnm/",
  "/.volta/",
  "/.asdf/",
  "/.n/",
  "/.nodenv/",
  "/.nodebrew/",
  "/nvs/",
];

function normalizeForCompare(input: string): string {
  return path.posix.normalize(input).replaceAll("\\", "/");
}

function buildSystemNodeCandidates(): string[] {
  return ["/usr/local/bin/node", "/usr/bin/node"];
}

type ExecFileAsync = (
  file: string,
  args: readonly string[],
  options: { encoding: "utf8" },
) => Promise<{ stdout: string; stderr: string }>;

const execFileAsync = promisify(execFile) as unknown as ExecFileAsync;

async function resolveNodeVersion(
  nodePath: string,
  execFileImpl: ExecFileAsync,
): Promise<string | null> {
  try {
    const { stdout } = await execFileImpl(nodePath, ["-p", "process.versions.node"], {
      encoding: "utf8",
    });
    const value = stdout.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export type SystemNodeInfo = {
  path: string;
  version: string | null;
  supported: boolean;
};

export function isVersionManagedNodePath(nodePath: string): boolean {
  const normalized = normalizeForCompare(nodePath);
  return VERSION_MANAGER_MARKERS.some((marker) => normalized.includes(marker));
}

export function isSystemNodePath(
  nodePath: string,
  _env: Record<string, string | undefined> = process.env,
): boolean {
  const normalized = normalizeForCompare(nodePath);
  return buildSystemNodeCandidates().some((candidate) => {
    const normalizedCandidate = normalizeForCompare(candidate);
    return normalized === normalizedCandidate;
  });
}

export async function resolveSystemNodePath(
  _env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const candidates = buildSystemNodeCandidates();
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep going
    }
  }
  return null;
}

export async function resolveSystemNodeInfo(params: {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  execFile?: ExecFileAsync;
}): Promise<SystemNodeInfo | null> {
  const env = params.env ?? process.env;
  const systemNode = await resolveSystemNodePath(env);
  if (!systemNode) {
    return null;
  }

  const version = await resolveNodeVersion(systemNode, params.execFile ?? execFileAsync);
  return {
    path: systemNode,
    version,
    supported: isSupportedNodeVersion(version),
  };
}

export function renderSystemNodeWarning(
  systemNode: SystemNodeInfo | null,
  selectedNodePath?: string,
): string | null {
  if (!systemNode || systemNode.supported) {
    return null;
  }
  const versionLabel = systemNode.version ?? "unknown";
  const selectedLabel = selectedNodePath ? ` Using ${selectedNodePath} for the daemon.` : "";
  return `System Node ${versionLabel} at ${systemNode.path} is below the required Node 22+.${selectedLabel} Install Node 22+ from nodejs.org.`;
}

export async function resolvePreferredNodePath(params: {
  env?: Record<string, string | undefined>;
  runtime?: string;
  execFile?: ExecFileAsync;
}): Promise<string | undefined> {
  if (params.runtime !== "node") {
    return undefined;
  }
  const systemNode = await resolveSystemNodeInfo(params);
  if (!systemNode?.supported) {
    return undefined;
  }
  return systemNode.path;
}
