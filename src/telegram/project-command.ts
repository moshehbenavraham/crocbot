import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureProjectWorkspace,
  isDefaultProject,
  normalizeProjectId,
} from "../agents/project-scope.js";
import { findAgentEntryIndex, listAgentEntries } from "../commands/agents.config.js";
import { loadConfig, writeConfigFile } from "../config/config.js";
import { STATE_DIR } from "../config/paths.js";
import type { ProjectConfig } from "../config/types.projects.js";
import { DEFAULT_PROJECT_ID } from "../config/types.projects.js";
import { normalizeAgentId } from "../routing/session-key.js";

export type ProjectSubcommand =
  | { action: "list" }
  | { action: "current" }
  | { action: "switch"; projectId: string }
  | { action: "create"; projectId: string }
  | { action: "help" };

export function parseProjectSubcommand(text: string): ProjectSubcommand {
  const trimmed = text.trim();
  if (!trimmed) {
    return { action: "help" };
  }

  const parts = trimmed.split(/\s+/);
  const subcommand = parts[0].toLowerCase();
  const arg = parts[1]?.trim() || "";

  switch (subcommand) {
    case "list":
    case "ls":
      return { action: "list" };
    case "current":
    case "status":
      return { action: "current" };
    case "switch":
    case "use":
      if (!arg) {
        return { action: "help" };
      }
      return { action: "switch", projectId: arg };
    case "create":
    case "new":
      if (!arg) {
        return { action: "help" };
      }
      return { action: "create", projectId: arg };
    default:
      // Treat bare argument as switch shortcut: `/project myproject`
      return { action: "switch", projectId: subcommand };
  }
}

export type ProjectCommandResult = {
  ok: boolean;
  text: string;
};

type ProjectCommandContext = {
  agentId: string;
  getActiveProjectId: () => string;
  setActiveProjectId: (projectId: string) => void;
};

export async function executeProjectSubcommand(
  sub: ProjectSubcommand,
  ctx: ProjectCommandContext,
): Promise<ProjectCommandResult> {
  switch (sub.action) {
    case "help":
      return { ok: true, text: formatHelpText() };
    case "list":
      return await handleList(ctx);
    case "current":
      return handleCurrent(ctx);
    case "switch":
      return await handleSwitch(sub.projectId, ctx);
    case "create":
      return await handleCreate(sub.projectId, ctx);
  }
}

function formatHelpText(): string {
  return [
    "Project commands:",
    "  /project list - List all projects",
    "  /project current - Show active project",
    "  /project switch <name> - Switch to a project",
    "  /project create <name> - Create a new project",
    "  /project <name> - Shortcut for switch",
  ].join("\n");
}

async function handleList(ctx: ProjectCommandContext): Promise<ProjectCommandResult> {
  const cfg = loadConfig();
  const agentId = ctx.agentId;
  const entries = listAgentEntries(cfg);
  const entry = entries.find((e) => normalizeAgentId(e.id) === agentId);
  const projects = entry?.projects ?? [];
  const activeId = ctx.getActiveProjectId();

  const lines: string[] = ["Projects:"];
  const isActive = isDefaultProject(activeId);
  lines.push(`  ${isActive ? "* " : "  "}default (built-in)`);

  for (const project of projects) {
    if (isDefaultProject(project.id)) {
      continue;
    }
    const pid = normalizeProjectId(project.id);
    const active = pid === activeId;
    const label = project.name ? `${pid} - ${project.name}` : pid;
    lines.push(`  ${active ? "* " : "  "}${label}`);
  }

  if (projects.filter((p) => !isDefaultProject(p.id)).length === 0) {
    lines.push("  (no custom projects)");
  }

  return { ok: true, text: lines.join("\n") };
}

function handleCurrent(ctx: ProjectCommandContext): ProjectCommandResult {
  const activeId = ctx.getActiveProjectId();
  const label = isDefaultProject(activeId) ? "default" : activeId;
  return { ok: true, text: `Active project: ${label}` };
}

async function handleSwitch(
  rawProjectId: string,
  ctx: ProjectCommandContext,
): Promise<ProjectCommandResult> {
  const cfg = loadConfig();
  const agentId = ctx.agentId;
  const projectId = normalizeProjectId(rawProjectId);

  // Switching to default is always allowed
  if (!isDefaultProject(projectId)) {
    const entries = listAgentEntries(cfg);
    const entry = entries.find((e) => normalizeAgentId(e.id) === agentId);
    const projects = entry?.projects ?? [];
    if (!projects.some((p) => normalizeProjectId(p.id) === projectId)) {
      return {
        ok: false,
        text: `Project "${projectId}" not found. Use /project list to see available projects.`,
      };
    }
  }

  ctx.setActiveProjectId(projectId);
  const label = isDefaultProject(projectId) ? "default" : projectId;
  return { ok: true, text: `Switched to project: ${label}` };
}

async function handleCreate(
  rawProjectId: string,
  ctx: ProjectCommandContext,
): Promise<ProjectCommandResult> {
  const cfg = loadConfig();
  const agentId = ctx.agentId;

  let projectId: string;
  try {
    projectId = normalizeProjectId(rawProjectId);
  } catch {
    return { ok: false, text: `Invalid project ID: "${rawProjectId}"` };
  }

  if (isDefaultProject(projectId)) {
    return { ok: false, text: `"${DEFAULT_PROJECT_ID}" is reserved and cannot be created.` };
  }

  const entries = listAgentEntries(cfg);
  const entryIdx = findAgentEntryIndex(entries, agentId);
  if (entryIdx < 0) {
    return { ok: false, text: `Agent "${agentId}" not found in config.` };
  }

  const existingProjects = entries[entryIdx].projects ?? [];
  if (existingProjects.some((p) => normalizeProjectId(p.id) === projectId)) {
    return { ok: false, text: `Project "${projectId}" already exists.` };
  }

  const newProject: ProjectConfig = { id: projectId };
  const updatedEntry = {
    ...entries[entryIdx],
    projects: [...existingProjects, newProject],
  };
  const nextList = [...entries];
  nextList[entryIdx] = updatedEntry;
  const nextConfig = {
    ...cfg,
    agents: { ...cfg.agents, list: nextList },
  };

  await ensureProjectWorkspace(nextConfig, agentId, projectId);
  await writeConfigFile(nextConfig);

  return {
    ok: true,
    text: `Project "${projectId}" created. Use /project switch ${projectId} to activate it.`,
  };
}

// -- Persistent per-chat project store --

const CHAT_PROJECTS_FILENAME = "chat-projects.json";

function chatProjectsPath(): string {
  return path.join(STATE_DIR, "telegram", CHAT_PROJECTS_FILENAME);
}

type ChatProjectMap = Record<string, string>;

async function readChatProjects(): Promise<ChatProjectMap> {
  try {
    const raw = await fs.readFile(chatProjectsPath(), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ChatProjectMap;
    }
  } catch {
    // File may not exist yet
  }
  return {};
}

async function writeChatProjects(map: ChatProjectMap): Promise<void> {
  const filePath = chatProjectsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(map, null, 2) + "\n", "utf-8");
}

/**
 * Build a chat key for the per-chat project store.
 * Format: `{chatId}:{agentId}` to scope per agent per chat.
 */
function chatProjectKey(chatId: string | number, agentId: string): string {
  return `${chatId}:${normalizeAgentId(agentId)}`;
}

/**
 * Read the active project for a Telegram chat.
 * Returns DEFAULT_PROJECT_ID if none is stored.
 */
export async function readChatActiveProject(
  chatId: string | number,
  agentId: string,
): Promise<string> {
  const map = await readChatProjects();
  const key = chatProjectKey(chatId, agentId);
  const stored = map[key]?.trim();
  return stored || DEFAULT_PROJECT_ID;
}

/**
 * Write the active project for a Telegram chat.
 */
export async function writeChatActiveProject(
  chatId: string | number,
  agentId: string,
  projectId: string,
): Promise<void> {
  const map = await readChatProjects();
  const key = chatProjectKey(chatId, agentId);
  const normalized = normalizeProjectId(projectId);
  if (isDefaultProject(normalized)) {
    delete map[key];
  } else {
    map[key] = normalized;
  }
  await writeChatProjects(map);
}
