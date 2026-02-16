/** Memory isolation mode for projects. */
export type MemoryIsolationMode = "full" | "shared" | "inherit";

/** Default project identifier (implicit project for agents without explicit projects). */
export const DEFAULT_PROJECT_ID = "default";

/** Configuration for a single project within an agent. */
export interface ProjectConfig {
  /** Unique project identifier (kebab-case, 1-64 chars). */
  id: string;
  /** Human-readable project name. */
  name?: string;
  /** Optional description of the project. */
  description?: string;
  /** Memory isolation mode for this project. */
  memoryIsolation?: MemoryIsolationMode;
}

/** Runtime metadata persisted alongside each project directory. */
export interface ProjectMetadata {
  /** Normalized project identifier. */
  projectId: string;
  /** ISO-8601 timestamp when the project was created. */
  createdAt: string;
  /** ISO-8601 timestamp when the project was last accessed. */
  lastAccessedAt: string;
  /** Schema version for forward-compatible migrations. */
  schemaVersion: number;
}

/** Resolved filesystem paths for a named (non-default) project. */
export interface ProjectScopedPaths {
  /** Root project directory: {STATE_DIR}/agents/{agentId}/projects/{projectId}/ */
  projectDir: string;
  /** Workspace directory: {projectDir}/workspace/ */
  workspaceDir: string;
  /** Memory directory: {projectDir}/memory/ */
  memoryDir: string;
  /** Settings directory: {projectDir}/settings/ */
  settingsDir: string;
  /** Logs directory: {projectDir}/logs/ */
  logsDir: string;
  /** Metadata file path: {projectDir}/project.json */
  metadataPath: string;
}

/** Fully resolved project context for runtime use. */
export interface ResolvedProjectContext {
  /** Normalized project identifier. */
  projectId: string;
  /** Whether this is the implicit default project. */
  isDefault: boolean;
  /** Scoped paths (undefined for default project). */
  paths: ProjectScopedPaths | undefined;
  /** Project metadata (undefined for default project or if not yet persisted). */
  metadata: ProjectMetadata | undefined;
  /** Workspace directory (always available -- delegates to agent workspace for default). */
  workspaceDir: string;
}
