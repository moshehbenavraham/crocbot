/**
 * Tool result masking transform.
 *
 * Deep-masks all string values in an AgentMessage (tool result) using
 * the SecretsRegistry.  Designed to compose with the existing
 * `transformToolResultForPersistence` callback in the session tool-result
 * guard wrapper so secrets are masked before they persist to the transcript.
 *
 * Uses maskStringsDeep(value, registry, false) -- value-based masking only.
 * Pattern-based redaction is disabled so that {{SECRET:hash8}} placeholders
 * remain exact and can be unmasked at execution time.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

import { maskStringsDeep } from "./logging-transport.js";
import { SecretsRegistry } from "./registry.js";

/**
 * Mask all string values in a tool result AgentMessage.
 *
 * Returns the message unchanged when the registry is empty (zero overhead).
 */
export function maskToolResultMessage(message: AgentMessage): AgentMessage {
  const registry = SecretsRegistry.getInstance();
  if (registry.size === 0) {
    return message;
  }
  return maskStringsDeep(message, registry, false) as AgentMessage;
}
