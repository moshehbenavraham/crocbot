/**
 * Call-site-based task classification for the 2-role model architecture.
 *
 * Maps fixed task type constants to model roles (reasoning or utility).
 * Classification is deterministic and call-site-based -- each call site
 * uses a fixed TaskType constant, not dynamic prompt analysis.
 *
 * @see docs/adr/0006-4-model-role-architecture.md
 */

import type { ModelRole } from "../config/types.model-roles.js";

// ---------------------------------------------------------------------------
// Task type definition
// ---------------------------------------------------------------------------

/** Supported task type identifiers for LLM call sites. */
export type TaskType = "reasoning" | "compaction" | "memory-flush" | "heartbeat" | "llm-task";

/** All valid task types as a const array for iteration and validation. */
export const TASK_TYPES = [
  "reasoning",
  "compaction",
  "memory-flush",
  "heartbeat",
  "llm-task",
] as const satisfies readonly TaskType[];

// ---------------------------------------------------------------------------
// Task classification
// ---------------------------------------------------------------------------

/** Result of classifying a task type to a model role. */
export interface TaskClassification {
  /** The classified task type. */
  taskType: TaskType;
  /** The model role this task should use. */
  role: ModelRole;
  /** Human-readable label for logging and observability. */
  label: string;
}

/**
 * Static mapping from each TaskType to its classification.
 *
 * Utility tasks (compaction, memory-flush, heartbeat, llm-task) route to
 * the utility model role. The reasoning task routes to the reasoning role.
 */
const TASK_CLASSIFICATION_MAP: Record<TaskType, TaskClassification> = {
  reasoning: { taskType: "reasoning", role: "reasoning", label: "agent-turn" },
  compaction: { taskType: "compaction", role: "utility", label: "compaction" },
  "memory-flush": { taskType: "memory-flush", role: "utility", label: "memory-flush" },
  heartbeat: { taskType: "heartbeat", role: "utility", label: "heartbeat" },
  "llm-task": { taskType: "llm-task", role: "utility", label: "llm-task" },
};

// ---------------------------------------------------------------------------
// Classifier function
// ---------------------------------------------------------------------------

/**
 * Classify a task type to a model role.
 *
 * Looks up the task type in the static classification map. Unknown task
 * types default to reasoning (the safe fallback -- reasoning model handles
 * everything, utility is the optimization path).
 */
export function classifyTask(taskType: string): TaskClassification {
  const classification = TASK_CLASSIFICATION_MAP[taskType as TaskType];
  if (classification) {
    return classification;
  }

  // Unknown task types default to reasoning
  return {
    taskType: taskType as TaskType,
    role: "reasoning",
    label: taskType || "unknown",
  };
}
