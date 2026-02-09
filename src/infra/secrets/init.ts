/**
 * Startup initialization helper for the SecretsRegistry.
 *
 * Wraps SecretsRegistry.getInstance().init() with config loading for both
 * gateway and CLI startup paths. Must be called before the first log line
 * is written so all output boundaries can mask registered secrets.
 */

import type { RegistryOptions } from "./registry.js";
import { SecretsRegistry } from "./registry.js";

/**
 * Initialize the process-wide SecretsRegistry singleton.
 *
 * Discovers secrets from process.env and optionally from a loaded config
 * object. Safe to call multiple times (secrets accumulate).
 *
 * @param config - Optional config object to scan for sensitive values.
 * @param options - Optional registry init options (e.g. skipEnv).
 */
export function initSecretsRegistry(
  config?: Record<string, unknown>,
  options?: RegistryOptions,
): SecretsRegistry {
  const registry = SecretsRegistry.getInstance();
  registry.init(config, options);
  return registry;
}
