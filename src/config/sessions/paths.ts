import os from "node:os";
import path from "node:path";
import { isDefaultProject, normalizeProjectId } from "../../agents/project-scope.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../routing/session-key.js";
import { resolveStateDir } from "../paths.js";
import type { SessionEntry } from "./types.js";

function resolveAgentSessionsDir(
  agentId?: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const root = resolveStateDir(env, homedir);
  const id = normalizeAgentId(agentId ?? DEFAULT_AGENT_ID);
  return path.join(root, "agents", id, "sessions");
}

export function resolveSessionTranscriptsDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return resolveAgentSessionsDir(DEFAULT_AGENT_ID, env, homedir);
}

export function resolveSessionTranscriptsDirForAgent(
  agentId?: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
  projectId?: string | null,
): string {
  if (!isDefaultProject(projectId)) {
    return resolveProjectSessionsDir(agentId, projectId, env, homedir);
  }
  return resolveAgentSessionsDir(agentId, env, homedir);
}

/**
 * Resolve the sessions directory for a project.
 *
 * For the default project, delegates to the agent-level sessions dir.
 * For named projects, returns `{STATE_DIR}/agents/{agentId}/projects/{projectId}/sessions/`.
 */
export function resolveProjectSessionsDir(
  agentId?: string,
  projectId?: string | null,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  if (isDefaultProject(projectId)) {
    return resolveAgentSessionsDir(agentId, env, homedir);
  }
  const root = resolveStateDir(env, homedir);
  const id = normalizeAgentId(agentId ?? DEFAULT_AGENT_ID);
  const normalizedProject = normalizeProjectId(projectId);
  return path.join(root, "agents", id, "projects", normalizedProject, "sessions");
}

export function resolveDefaultSessionStorePath(agentId?: string): string {
  return path.join(resolveAgentSessionsDir(agentId), "sessions.json");
}

export function resolveSessionTranscriptPath(
  sessionId: string,
  agentId?: string,
  topicId?: string | number,
  projectId?: string | null,
): string {
  const safeTopicId =
    typeof topicId === "string"
      ? encodeURIComponent(topicId)
      : typeof topicId === "number"
        ? String(topicId)
        : undefined;
  const fileName =
    safeTopicId !== undefined ? `${sessionId}-topic-${safeTopicId}.jsonl` : `${sessionId}.jsonl`;
  const dir = isDefaultProject(projectId)
    ? resolveAgentSessionsDir(agentId)
    : resolveProjectSessionsDir(agentId, projectId);
  return path.join(dir, fileName);
}

export function resolveSessionFilePath(
  sessionId: string,
  entry?: SessionEntry,
  opts?: { agentId?: string },
): string {
  const candidate = entry?.sessionFile?.trim();
  return candidate ? candidate : resolveSessionTranscriptPath(sessionId, opts?.agentId);
}

export function resolveStorePath(store?: string, opts?: { agentId?: string }) {
  const agentId = normalizeAgentId(opts?.agentId ?? DEFAULT_AGENT_ID);
  if (!store) {
    return resolveDefaultSessionStorePath(agentId);
  }
  if (store.includes("{agentId}")) {
    const expanded = store.replaceAll("{agentId}", agentId);
    if (expanded.startsWith("~")) {
      return path.resolve(expanded.replace(/^~(?=$|[\\/])/, os.homedir()));
    }
    return path.resolve(expanded);
  }
  if (store.startsWith("~")) {
    return path.resolve(store.replace(/^~(?=$|[\\/])/, os.homedir()));
  }
  return path.resolve(store);
}
