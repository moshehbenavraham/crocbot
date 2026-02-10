/**
 * Model role configuration types for the 2-role architecture (reasoning + utility).
 *
 * Roles map to provider/model pairs and allow routing mechanical tasks
 * (compaction, memory flush, heartbeat) to cheaper utility models while
 * preserving the primary reasoning model for user-facing interactions.
 *
 * @see docs/adr/0006-4-model-role-architecture.md
 */

/** Supported model role identifiers. */
export type ModelRole = "reasoning" | "utility";

/**
 * Configuration for a single model role.
 *
 * Accepts either a string shorthand ("provider/model") or an object with
 * an explicit model reference and optional provider-specific parameter overrides.
 */
export interface ModelRoleConfig {
  /** Model reference in "provider/model" format. */
  model: string;
  /** Optional provider-specific parameter overrides (temperature, maxTokens, etc.). */
  params?: Record<string, unknown>;
}

/** Input type for role config: string shorthand or full object. */
export type ModelRoleConfigInput = string | ModelRoleConfig;

/**
 * Top-level model roles configuration.
 *
 * Both fields are optional -- missing entries fall back to the primary
 * reasoning model configured in `agents.defaults.model.primary`.
 */
export interface ModelRolesConfig {
  /** Model for user-facing reasoning tasks (chat, cron jobs, followup). */
  reasoning?: ModelRoleConfigInput;
  /** Model for mechanical utility tasks (compaction, memory flush, heartbeat). */
  utility?: ModelRoleConfigInput;
}
