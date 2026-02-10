/**
 * Model role resolution logic for the 2-role architecture (reasoning + utility).
 *
 * Pure functions that parse, normalize, and resolve model role configurations
 * to provider/model pairs. No side effects -- fully testable without mocks.
 *
 * @see docs/adr/0006-4-model-role-architecture.md
 */

import type {
  ModelRole,
  ModelRoleConfigInput,
  ModelRolesConfig,
} from "../config/types.model-roles.js";

/** Result of parsing a "provider/model" reference string. */
export interface ParsedModelReference {
  /** Provider identifier (everything before the first slash). */
  provider: string;
  /** Model identifier (everything after the first slash). */
  modelId: string;
}

/** Canonical form of a role configuration after normalization. */
export interface NormalizedRoleConfig {
  /** Model reference in "provider/model" format. */
  model: string;
  /** Optional provider-specific parameter overrides. */
  params?: Record<string, unknown>;
}

/** Result of resolving a model role to a concrete provider/model pair. */
export interface ResolvedModelRole {
  /** Provider identifier. */
  provider: string;
  /** Model identifier. */
  modelId: string;
  /** Full model reference ("provider/modelId"). */
  model: string;
  /** True when the resolved model is the primary fallback (role was unconfigured or invalid). */
  isFallback: boolean;
  /** Optional provider-specific parameter overrides from role config. */
  params?: Record<string, unknown>;
}

/**
 * Parse a "provider/model" reference string into its component parts.
 *
 * Splits on the **first** slash only, so model IDs containing slashes
 * (unlikely but defensive) are preserved. Returns `null` for empty
 * strings or strings without a slash separator.
 */
export function parseModelReference(ref: string): ParsedModelReference | null {
  const trimmed = ref.trim();
  if (!trimmed) {
    return null;
  }

  const slashIndex = trimmed.indexOf("/");
  if (slashIndex === -1) {
    return null;
  }

  const provider = trimmed.slice(0, slashIndex).trim();
  const modelId = trimmed.slice(slashIndex + 1).trim();

  if (!provider || !modelId) {
    return null;
  }

  return { provider, modelId };
}

/**
 * Normalize a role config input (string shorthand, object, or undefined)
 * into the canonical `NormalizedRoleConfig` form.
 *
 * Returns `null` when the input is undefined, an empty string, or an
 * object with an empty/missing model field.
 */
export function normalizeRoleConfig(
  input: ModelRoleConfigInput | undefined,
): NormalizedRoleConfig | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    return { model: trimmed };
  }

  const model = input.model?.trim() ?? "";
  if (!model) {
    return null;
  }

  const result: NormalizedRoleConfig = { model };
  if (input.params && Object.keys(input.params).length > 0) {
    result.params = input.params;
  }
  return result;
}

/**
 * Resolve a model role to a concrete provider/model pair.
 *
 * Resolution order:
 * 1. Look up the role in `rolesConfig`
 * 2. Normalize the config entry (string -> object form)
 * 3. Parse the model reference into provider + modelId
 * 4. If any step fails, fall back to `primaryModel`
 *
 * The `primaryModel` parameter should be the configured primary reasoning
 * model from `agents.defaults.model.primary` (in "provider/model" format).
 */
export function resolveModelRole(
  role: ModelRole,
  rolesConfig: ModelRolesConfig | undefined,
  primaryModel: string,
): ResolvedModelRole {
  const makeFallback = (): ResolvedModelRole => {
    const parsed = parseModelReference(primaryModel);
    if (parsed) {
      return {
        provider: parsed.provider,
        modelId: parsed.modelId,
        model: primaryModel,
        isFallback: true,
      };
    }
    // Last resort: return the raw primary string as-is
    return {
      provider: "",
      modelId: primaryModel,
      model: primaryModel,
      isFallback: true,
    };
  };

  if (!rolesConfig) {
    return makeFallback();
  }

  const roleInput = rolesConfig[role];
  const normalized = normalizeRoleConfig(roleInput);
  if (!normalized) {
    return makeFallback();
  }

  const parsed = parseModelReference(normalized.model);
  if (!parsed) {
    return makeFallback();
  }

  return {
    provider: parsed.provider,
    modelId: parsed.modelId,
    model: normalized.model,
    isFallback: false,
    params: normalized.params,
  };
}
