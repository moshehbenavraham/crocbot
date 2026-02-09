/**
 * Execution-time unmasking for tool arguments.
 *
 * Deep-walks tool argument objects and replaces {{SECRET:hash8}} placeholders
 * with real values via registry.unmask().  Called at the tool execution
 * boundary only -- unmasked values must never reach event emitters or logs.
 */

import { SecretsRegistry } from "./registry.js";

/**
 * Recursively unmask all string values in a tool arguments structure.
 * Non-string primitives and nulls pass through unchanged.
 */
export function unmaskForExecution(args: unknown, registry: SecretsRegistry): unknown {
  if (registry.size === 0) {
    return args;
  }

  if (args === null || args === undefined) {
    return args;
  }

  if (typeof args === "string") {
    return registry.unmask(args);
  }

  if (typeof args !== "object") {
    return args;
  }

  if (Array.isArray(args)) {
    return args.map((item) => unmaskForExecution(item, registry));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(args as Record<string, unknown>)) {
    result[key] = unmaskForExecution(val, registry);
  }
  return result;
}
