/**
 * LLM request body masking interceptor.
 *
 * Follows the established wrapStreamFn(streamFn) => StreamFn decorator
 * pattern from cache-trace.ts and anthropic-payload-log.ts.  Deep-masks
 * all string values in the context (system prompt, messages, tool results)
 * before the request leaves the process, so no registered secret value
 * is ever sent to an external LLM provider.
 *
 * Uses maskStringsDeep(value, registry, false) -- value-based masking only.
 * Pattern-based redaction is intentionally disabled because the LLM context
 * needs exact {{SECRET:hash8}} placeholders that can later be unmasked at
 * tool execution time.
 */

import type { StreamFn } from "@mariozechner/pi-agent-core";

import { maskStringsDeep } from "./logging-transport.js";
import { SecretsRegistry } from "./registry.js";

/**
 * Wrap a StreamFn so that the context sent to the LLM provider has all
 * registered secret values replaced with {{SECRET:hash8}} placeholders.
 *
 * No-op when the registry is empty.
 */
export function wrapStreamFnWithMasking(streamFn: StreamFn): StreamFn {
  const registry = SecretsRegistry.getInstance();

  const wrapped: StreamFn = (model, context, options) => {
    if (registry.size === 0) {
      return streamFn(model, context, options);
    }

    const maskedContext = maskStringsDeep(context, registry, false) as typeof context;
    return streamFn(model, maskedContext, options);
  };

  return wrapped;
}
