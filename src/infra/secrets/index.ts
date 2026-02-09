/**
 * Secrets masking pipeline -- public API.
 *
 * Provides a centralized registry that auto-discovers secret values from
 * environment variables and config objects, then masks/unmasks them in
 * arbitrary text using deterministic {{SECRET:hash8}} placeholders.
 */

export { SecretsRegistry } from "./registry.js";
export type { SecretEntry, RegistryOptions } from "./registry.js";
export { createMasker, computeHash8, makePlaceholder } from "./masker.js";
export type { SecretsMasker, EncodingVariant } from "./masker.js";
export { initSecretsRegistry } from "./init.js";
export { createMaskingTransport, maskStringsDeep } from "./logging-transport.js";
