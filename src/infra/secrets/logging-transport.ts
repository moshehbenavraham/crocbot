/**
 * tslog masking transport for the SecretsRegistry.
 *
 * Intercepts log records and applies two masking strategies in order:
 * 1. Value-based masking via registry.mask() (catches exact registered values)
 * 2. Pattern-based redaction via redactSensitiveText() (catches format-based patterns)
 *
 * Value-based runs first because pattern-based truncates values (e.g. sk-abcd...mnop)
 * which would prevent the registry from finding the full value.
 */

import { redactSensitiveText } from "../../logging/redact.js";
import { SecretsRegistry } from "./registry.js";

/**
 * Recursively mask all string values in a value using both masking strategies.
 * Non-string primitives and nulls pass through unchanged.
 *
 * Composition order: value-based first, then pattern-based.
 */
export function maskStringsDeep(
  value: unknown,
  registry: SecretsRegistry,
  applyPatternRedaction: boolean,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    // 1. Value-based masking (exact registered values)
    let masked = registry.mask(value);
    // 2. Pattern-based redaction (format-based patterns like sk-*, Bearer, etc.)
    if (applyPatternRedaction) {
      masked = redactSensitiveText(masked);
    }
    return masked;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskStringsDeep(item, registry, applyPatternRedaction));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = maskStringsDeep(val, registry, applyPatternRedaction);
  }
  return result;
}

/**
 * Create a tslog transport function that masks all string fields in a log
 * record using both value-based (SecretsRegistry) and pattern-based
 * (redactSensitiveText) masking.
 *
 * Designed to be registered via `registerLogTransport()` in
 * `src/logging/logger.ts`. The transport mutates the record in place
 * so downstream transports (file, console) see masked values.
 */
export function createMaskingTransport(): (logObj: Record<string, unknown>) => void {
  const registry = SecretsRegistry.getInstance();

  return (logObj: Record<string, unknown>): void => {
    for (const key of Object.keys(logObj)) {
      logObj[key] = maskStringsDeep(logObj[key], registry, true);
    }
  };
}
