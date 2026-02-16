import type { GatewayRequestHandlers } from "./types.js";
import { listAgentIds, resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import {
  ensureProjectWorkspace,
  isDefaultProject,
  normalizeProjectId,
  resolveProjectContext,
  resolveProjectDir,
  resolveProjectPaths,
} from "../../agents/project-scope.js";
import { movePathToTrash } from "../../browser/trash.js";
import { findAgentEntryIndex, listAgentEntries } from "../../commands/agents.config.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import type { ProjectConfig } from "../../config/types.projects.js";
import { DEFAULT_PROJECT_ID } from "../../config/types.projects.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { extractProjectFromSessionKey } from "../../routing/session-key.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateProjectsCreateParams,
  validateProjectsCurrentParams,
  validateProjectsDeleteParams,
  validateProjectsListParams,
  validateProjectsSwitchParams,
} from "../protocol/index.js";

function resolveAgentIdParam(raw: unknown, cfg: ReturnType<typeof loadConfig>): string | null {
  const agentId = normalizeAgentId(typeof raw === "string" ? raw : undefined);
  const allowed = new Set(listAgentIds(cfg));
  if (!allowed.has(agentId)) {
    return null;
  }
  return agentId;
}

function findAgentProjects(cfg: ReturnType<typeof loadConfig>, agentId: string): ProjectConfig[] {
  const entries = listAgentEntries(cfg);
  const entry = entries.find((e) => normalizeAgentId(e.id) === agentId);
  return entry?.projects ?? [];
}

async function moveToTrashBestEffort(pathname: string): Promise<void> {
  if (!pathname) {
    return;
  }
  try {
    const { access } = await import("node:fs/promises");
    await access(pathname);
  } catch {
    return;
  }
  try {
    await movePathToTrash(pathname);
  } catch {
    // Best-effort: path may already be gone or trash unavailable.
  }
}

export const projectsHandlers: GatewayRequestHandlers = {
  "projects.list": async ({ params, respond }) => {
    if (!validateProjectsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid projects.list params: ${formatValidationErrors(validateProjectsListParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const agentId = resolveAgentIdParam(params.agentId, cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const configProjects = findAgentProjects(cfg, agentId);
    const agentWorkspaceDir = resolveAgentWorkspaceDir(cfg, agentId);

    // Always include the default project
    const projects: Array<Record<string, unknown>> = [
      {
        id: DEFAULT_PROJECT_ID,
        name: "Default",
        isDefault: true,
        workspaceDir: agentWorkspaceDir,
      },
    ];

    for (const project of configProjects) {
      if (isDefaultProject(project.id)) {
        continue;
      }
      const ctx = await resolveProjectContext(cfg, agentId, project.id);
      projects.push({
        id: normalizeProjectId(project.id),
        name: project.name,
        description: project.description,
        memoryIsolation: project.memoryIsolation,
        isDefault: false,
        workspaceDir: ctx.workspaceDir,
        createdAt: ctx.metadata?.createdAt,
        lastAccessedAt: ctx.metadata?.lastAccessedAt,
      });
    }

    respond(true, { agentId, projects }, undefined);
  },

  "projects.current": ({ params, respond }) => {
    if (!validateProjectsCurrentParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid projects.current params: ${formatValidationErrors(validateProjectsCurrentParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const agentId = resolveAgentIdParam(params.agentId, cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    // Determine active project: from sessionKey, env var, agent default, or global default
    const sessionKeyProject = extractProjectFromSessionKey(
      typeof params.sessionKey === "string" ? params.sessionKey : undefined,
    );
    const envProject = process.env.CROCBOT_ACTIVE_PROJECT?.trim() || undefined;

    const entries = listAgentEntries(cfg);
    const entry = entries.find((e) => normalizeAgentId(e.id) === agentId);
    const agentDefaultProject = entry?.defaultProject?.trim() || undefined;

    const rawProjectId = sessionKeyProject ?? envProject ?? agentDefaultProject;
    const projectId = normalizeProjectId(rawProjectId);
    const isDefault = isDefaultProject(projectId);

    const workspaceDir = isDefault
      ? resolveAgentWorkspaceDir(cfg, agentId)
      : (() => {
          try {
            return resolveProjectPaths(cfg, agentId, projectId).workspaceDir;
          } catch {
            return undefined;
          }
        })();

    respond(true, { agentId, projectId, isDefault, workspaceDir }, undefined);
  },

  "projects.create": async ({ params, respond }) => {
    if (!validateProjectsCreateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid projects.create params: ${formatValidationErrors(validateProjectsCreateParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const agentId = resolveAgentIdParam(params.agentId, cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const projectId = normalizeProjectId(String(params.projectId ?? ""));
    if (isDefaultProject(projectId)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `"${DEFAULT_PROJECT_ID}" is reserved`),
      );
      return;
    }

    // Check for duplicates
    const existingProjects = findAgentProjects(cfg, agentId);
    if (existingProjects.some((p) => normalizeProjectId(p.id) === projectId)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `project "${projectId}" already exists`),
      );
      return;
    }

    // Add project to agent config
    const entries = listAgentEntries(cfg);
    const entryIdx = findAgentEntryIndex(entries, agentId);
    if (entryIdx < 0) {
      // Agent must exist in config (even default agent should be listable)
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `agent "${agentId}" not found in config`),
      );
      return;
    }

    const newProject: ProjectConfig = {
      id: projectId,
      ...(typeof params.name === "string" && params.name.trim()
        ? { name: params.name.trim() }
        : {}),
      ...(typeof params.description === "string" && params.description.trim()
        ? { description: params.description.trim() }
        : {}),
      ...(typeof params.memoryIsolation === "string"
        ? { memoryIsolation: params.memoryIsolation as ProjectConfig["memoryIsolation"] }
        : {}),
    };

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

    // Bootstrap workspace before writing config
    const paths = await ensureProjectWorkspace(nextConfig, agentId, projectId);
    await writeConfigFile(nextConfig);

    respond(true, { ok: true, agentId, projectId, workspaceDir: paths.workspaceDir }, undefined);
  },

  "projects.delete": async ({ params, respond }) => {
    if (!validateProjectsDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid projects.delete params: ${formatValidationErrors(validateProjectsDeleteParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const agentId = resolveAgentIdParam(params.agentId, cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const projectId = normalizeProjectId(String(params.projectId ?? ""));
    if (isDefaultProject(projectId)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `"${DEFAULT_PROJECT_ID}" cannot be deleted`),
      );
      return;
    }

    const existingProjects = findAgentProjects(cfg, agentId);
    if (!existingProjects.some((p) => normalizeProjectId(p.id) === projectId)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `project "${projectId}" not found`),
      );
      return;
    }

    // Remove from config
    const entries = listAgentEntries(cfg);
    const entryIdx = findAgentEntryIndex(entries, agentId);
    if (entryIdx < 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `agent "${agentId}" not found in config`),
      );
      return;
    }

    const filteredProjects = existingProjects.filter((p) => normalizeProjectId(p.id) !== projectId);
    const updatedEntry = {
      ...entries[entryIdx],
      projects: filteredProjects.length > 0 ? filteredProjects : undefined,
    };
    // If this was the defaultProject, clear it
    if (
      updatedEntry.defaultProject &&
      normalizeProjectId(updatedEntry.defaultProject) === projectId
    ) {
      delete updatedEntry.defaultProject;
    }
    const nextList = [...entries];
    nextList[entryIdx] = updatedEntry;
    const nextConfig = {
      ...cfg,
      agents: { ...cfg.agents, list: nextList },
    };

    await writeConfigFile(nextConfig);

    // Best-effort remove project directory
    try {
      const projectDir = resolveProjectDir(cfg, agentId, projectId);
      await moveToTrashBestEffort(projectDir);
    } catch {
      // Project dir resolution may fail if config is already gone; ignore.
    }

    respond(true, { ok: true, agentId, projectId }, undefined);
  },

  "projects.switch": async ({ params, respond }) => {
    if (!validateProjectsSwitchParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid projects.switch params: ${formatValidationErrors(validateProjectsSwitchParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const agentId = resolveAgentIdParam(params.agentId, cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const targetProjectId = normalizeProjectId(String(params.projectId ?? ""));

    // Validate the target project exists (unless switching to default)
    if (!isDefaultProject(targetProjectId)) {
      const existingProjects = findAgentProjects(cfg, agentId);
      if (!existingProjects.some((p) => normalizeProjectId(p.id) === targetProjectId)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `project "${targetProjectId}" not found`),
        );
        return;
      }
    }

    // Determine the previous project from session key or env
    const sessionKeyProject = extractProjectFromSessionKey(
      typeof params.sessionKey === "string" ? params.sessionKey : undefined,
    );
    const envProject = process.env.CROCBOT_ACTIVE_PROJECT?.trim() || undefined;
    const previousProjectId = normalizeProjectId(sessionKeyProject ?? envProject);

    // Update env for subsequent requests in this gateway process
    if (isDefaultProject(targetProjectId)) {
      delete process.env.CROCBOT_ACTIVE_PROJECT;
    } else {
      process.env.CROCBOT_ACTIVE_PROJECT = targetProjectId;
    }

    // Resolve workspace dir for the target project
    const ctx = await resolveProjectContext(cfg, agentId, targetProjectId);

    respond(
      true,
      {
        ok: true,
        agentId,
        projectId: targetProjectId,
        previousProjectId,
        workspaceDir: ctx.workspaceDir,
      },
      undefined,
    );
  },
};
