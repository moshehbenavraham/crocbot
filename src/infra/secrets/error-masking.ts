/**
 * Error message masking wrappers.
 *
 * Applies SecretsRegistry.mask() to the output of formatErrorMessage()
 * and formatUncaughtError() so that secrets embedded in error messages,
 * stack traces, or JSON-serialized error objects are never exposed in
 * user-facing output.
 *
 * Rather than creating separate functions that callers must migrate to,
 * this module is imported where needed and the masking is applied inline
 * at the error formatting call sites in src/infra/errors.ts.
 */

import { SecretsRegistry } from "./registry.js";

/**
 * Mask any registered secret values in a formatted error string.
 *
 * Returns the input unchanged when the registry is empty (zero overhead).
 */
export function maskErrorOutput(formatted: string): string {
  const registry = SecretsRegistry.getInstance();
  if (registry.size === 0) {
    return formatted;
  }
  return registry.mask(formatted);
}
