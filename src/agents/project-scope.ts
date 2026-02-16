import fs from "node:fs/promises";
import path from "node:path";

import type { crocbotConfig } from "../config/config.js";
import type {
  ProjectConfig,
  ProjectMetadata,
  ProjectScopedPaths,
  ResolvedProjectContext,
} from "../config/types.projects.js";
import { DEFAULT_PROJECT_ID } from "../config/types.projects.js";

import { resolveAgentDir, resolveAgentWorkspaceDir } from "./agent-scope.js";

// -- Validation regex (mirrors normalizeAgentId pattern) --

const VALID_PROJECT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

const PATH_TRAVERSAL_RE = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

const PROJECT_METADATA_FILENAME = "project.json";
const CURRENT_SCHEMA_VERSION = 1;

// -- ID normalization and predicates --

/**
 * Normalize a project identifier to kebab-case.
 * Returns DEFAULT_PROJECT_ID for undefined/null/empty input.
 * Rejects path traversal attempts.
 */
export function normalizeProjectId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_PROJECT_ID;
  }

  if (PATH_TRAVERSAL_RE.test(trimmed)) {
    throw new Error(`Invalid project ID: path traversal detected in "${trimmed}"`);
  }

  if (trimmed.toLowerCase() === DEFAULT_PROJECT_ID) {
    return DEFAULT_PROJECT_ID;
  }

  const lowered = trimmed.toLowerCase();
  if (VALID_PROJECT_ID_RE.test(lowered)) {
    return lowered;
  }

  // Best-effort fallback: collapse invalid characters to "-"
  const normalized =
    lowered
      .replace(INVALID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_PROJECT_ID;

  return normalized;
}

/** Returns true if the given project ID represents the implicit default project. */
export function isDefaultProject(projectId: string | undefined | null): boolean {
  const trimmed = (projectId ?? "").trim().toLowerCase();
  return !trimmed || trimmed === DEFAULT_PROJECT_ID;
}

// -- Path resolution --

/**
 * Resolve the root directory for a named project.
 * Returns `{STATE_DIR}/agents/{agentId}/projects/{projectId}/`.
 *
 * Throws if projectId resolves to the default project.
 */
export function resolveProjectDir(cfg: crocbotConfig, agentId: string, projectId: string): string {
  const normalizedProject = normalizeProjectId(projectId);
  if (isDefaultProject(normalizedProject)) {
    throw new Error("resolveProjectDir must not be called with the default project ID");
  }

  const agentDir = resolveAgentDir(cfg, agentId);
  // agentDir is {STATE_DIR}/agents/{agentId}/agent -- go up one level to get agent root
  const agentRoot = path.dirname(agentDir);
  return path.join(agentRoot, "projects", normalizedProject);
}

/**
 * Resolve the workspace directory for a project.
 *
 * For the default project (undefined/null/"default"), delegates to
 * `resolveAgentWorkspaceDir()` to maintain backward compatibility.
 *
 * For named projects, returns `{projectDir}/workspace/`.
 */
export function resolveProjectWorkspaceDir(
  cfg: crocbotConfig,
  agentId: string,
  projectId?: string | null,
): string {
  if (isDefaultProject(projectId)) {
    return resolveAgentWorkspaceDir(cfg, agentId);
  }
  const projectDir = resolveProjectDir(cfg, agentId, projectId as string);
  return path.join(projectDir, "workspace");
}

/**
 * Resolve all scoped paths for a named (non-default) project.
 *
 * Throws if called with the default project ID.
 */
export function resolveProjectPaths(
  cfg: crocbotConfig,
  agentId: string,
  projectId: string,
): ProjectScopedPaths {
  const normalizedProject = normalizeProjectId(projectId);
  if (isDefaultProject(normalizedProject)) {
    throw new Error("resolveProjectPaths must not be called with the default project ID");
  }

  const projectDir = resolveProjectDir(cfg, agentId, projectId);
  return {
    projectDir,
    workspaceDir: path.join(projectDir, "workspace"),
    memoryDir: path.join(projectDir, "memory"),
    settingsDir: path.join(projectDir, "settings"),
    logsDir: path.join(projectDir, "logs"),
    metadataPath: path.join(projectDir, PROJECT_METADATA_FILENAME),
  };
}

/**
 * Resolve the full project context for runtime use.
 *
 * For the default project, returns `isDefault: true` with paths/metadata undefined
 * and workspaceDir delegated to `resolveAgentWorkspaceDir()`.
 *
 * For named projects, returns the full scoped paths and attempts to read metadata.
 */
export async function resolveProjectContext(
  cfg: crocbotConfig,
  agentId: string,
  projectId?: string | null,
): Promise<ResolvedProjectContext> {
  const normalizedProject = normalizeProjectId(projectId);

  if (isDefaultProject(normalizedProject)) {
    return {
      projectId: DEFAULT_PROJECT_ID,
      isDefault: true,
      paths: undefined,
      metadata: undefined,
      workspaceDir: resolveAgentWorkspaceDir(cfg, agentId),
    };
  }

  const paths = resolveProjectPaths(cfg, agentId, normalizedProject);
  const metadata = await readProjectMetadata(paths.metadataPath);

  return {
    projectId: normalizedProject,
    isDefault: false,
    paths,
    metadata,
    workspaceDir: paths.workspaceDir,
  };
}

// -- Validation --

/** Validation error detail. */
export interface ProjectValidationError {
  projectId: string;
  message: string;
}

/**
 * Validate a list of project configs for an agent.
 *
 * Checks:
 * - No duplicate project IDs (after normalization)
 * - No path traversal in project IDs
 * - No project may use the reserved "default" ID
 *
 * Returns an array of validation errors (empty if valid).
 */
export function validateProjectConfig(
  projects: ProjectConfig[] | undefined | null,
): ProjectValidationError[] {
  if (!projects || projects.length === 0) {
    return [];
  }

  const errors: ProjectValidationError[] = [];
  const seen = new Set<string>();

  for (const project of projects) {
    const rawId = project.id;

    // Path traversal check (before normalization)
    if (PATH_TRAVERSAL_RE.test(rawId ?? "")) {
      errors.push({
        projectId: rawId ?? "",
        message: `Path traversal detected in project ID "${rawId}"`,
      });
      continue;
    }

    let normalizedId: string;
    try {
      normalizedId = normalizeProjectId(rawId);
    } catch {
      errors.push({
        projectId: rawId ?? "",
        message: `Invalid project ID "${rawId}"`,
      });
      continue;
    }

    // Reserved "default" check
    if (isDefaultProject(normalizedId)) {
      errors.push({
        projectId: rawId,
        message: `Project ID "${rawId}" resolves to the reserved default project ID`,
      });
      continue;
    }

    // Duplicate check
    if (seen.has(normalizedId)) {
      errors.push({
        projectId: rawId,
        message: `Duplicate project ID "${normalizedId}" (after normalization)`,
      });
      continue;
    }

    seen.add(normalizedId);
  }

  return errors;
}

// -- Persistence --

/**
 * Read project metadata from the given path.
 * Returns undefined if the file does not exist or cannot be parsed.
 */
export async function readProjectMetadata(
  metadataPath: string,
): Promise<ProjectMetadata | undefined> {
  try {
    const raw = await fs.readFile(metadataPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.projectId !== "string" || typeof obj.createdAt !== "string") {
      return undefined;
    }
    const { projectId, createdAt } = obj;
    const lastAccessedAt = typeof obj.lastAccessedAt === "string" ? obj.lastAccessedAt : createdAt;
    const schemaVersion = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 1;
    return { projectId, createdAt, lastAccessedAt, schemaVersion };
  } catch {
    return undefined;
  }
}

/**
 * Write project metadata to the given path.
 * Creates parent directories if needed.
 */
export async function writeProjectMetadata(
  metadataPath: string,
  metadata: ProjectMetadata,
): Promise<void> {
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  const json = JSON.stringify(metadata, null, 2) + "\n";
  await fs.writeFile(metadataPath, json, "utf-8");
}

/**
 * Bootstrap a project workspace.
 *
 * Creates the project directory tree (workspace/, memory/, settings/, logs/)
 * and writes initial metadata and MEMORY.md.
 *
 * Idempotent: safe to call on an existing project directory.
 */
export async function ensureProjectWorkspace(
  cfg: crocbotConfig,
  agentId: string,
  projectId: string,
): Promise<ProjectScopedPaths> {
  const paths = resolveProjectPaths(cfg, agentId, projectId);

  // Create all subdirectories
  await Promise.all([
    fs.mkdir(paths.workspaceDir, { recursive: true }),
    fs.mkdir(paths.memoryDir, { recursive: true }),
    fs.mkdir(paths.settingsDir, { recursive: true }),
    fs.mkdir(paths.logsDir, { recursive: true }),
  ]);

  // Write MEMORY.md if not present
  const memoryMdPath = path.join(paths.workspaceDir, "MEMORY.md");
  try {
    await fs.writeFile(memoryMdPath, "# Memory\n", { encoding: "utf-8", flag: "wx" });
  } catch (err) {
    const anyErr = err as { code?: string };
    if (anyErr.code !== "EEXIST") {
      throw err;
    }
  }

  // Write metadata if not present
  const existing = await readProjectMetadata(paths.metadataPath);
  if (!existing) {
    const now = new Date().toISOString();
    await writeProjectMetadata(paths.metadataPath, {
      projectId: normalizeProjectId(projectId),
      createdAt: now,
      lastAccessedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
  }

  return paths;
}
