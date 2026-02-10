/**
 * Model router for the 2-role architecture (reasoning + utility).
 *
 * Composes the task classifier with the role resolution logic to map
 * task types to concrete provider/model pairs. The router is the
 * linchpin between configuration (model roles) and integration (call sites).
 *
 * @see docs/adr/0006-4-model-role-architecture.md
 */

import type { ModelRole, ModelRolesConfig } from "../config/types.model-roles.js";
import type { ResolvedModelRole } from "./model-roles.js";
import { resolveModelRole } from "./model-roles.js";
import { classifyTask } from "./task-classifier.js";
import type { TaskType } from "./task-classifier.js";

// ---------------------------------------------------------------------------
// Router result
// ---------------------------------------------------------------------------

/** Result of routing a task through the model router. */
export interface ModelRouterResult extends ResolvedModelRole {
  /** The classified task type. */
  taskType: TaskType;
  /** Human-readable label for logging and observability. */
  label: string;
}

// ---------------------------------------------------------------------------
// Router interface
// ---------------------------------------------------------------------------

/** Model router that resolves task types to concrete provider/model pairs. */
export interface ModelRouter {
  /**
   * Resolve a task to a concrete provider/model pair.
   *
   * Classifies the task type, maps it to a model role, and resolves the
   * role to a provider/model pair. When the utility model is unavailable
   * or unconfigured, falls back to the reasoning model.
   */
  resolve(params: { taskType: TaskType }): ModelRouterResult;

  /**
   * Check if a specific model role is configured (non-fallback).
   *
   * Returns `true` when the role resolves to an explicitly configured
   * model, `false` when it would fall back to the primary model.
   * Reasoning is always considered available (falls back to primary).
   */
  hasRole(role: ModelRole): boolean;
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

/**
 * Create a model router instance.
 *
 * The router captures the roles config and primary model in a closure,
 * composing `classifyTask()` with `resolveModelRole()` to produce a
 * clean API for call sites.
 *
 * @param rolesConfig - Model roles configuration (from crocbot config)
 * @param primaryModel - Primary reasoning model in "provider/model" format
 */
export function createModelRouter(
  rolesConfig: ModelRolesConfig | undefined,
  primaryModel: string,
): ModelRouter {
  return {
    resolve(params: { taskType: TaskType }): ModelRouterResult {
      const classification = classifyTask(params.taskType);
      const resolved = resolveModelRole(classification.role, rolesConfig, primaryModel);

      return {
        ...resolved,
        taskType: classification.taskType,
        label: classification.label,
      };
    },

    hasRole(role: ModelRole): boolean {
      const resolved = resolveModelRole(role, rolesConfig, primaryModel);
      return !resolved.isFallback;
    },
  };
}
