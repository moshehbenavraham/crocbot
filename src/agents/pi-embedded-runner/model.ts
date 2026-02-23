import type { Api, Model } from "@mariozechner/pi-ai";
import { discoverAuthStorage, discoverModels } from "../pi-model-discovery.js";

import type { crocbotConfig } from "../../config/config.js";
import type { ModelDefinitionConfig } from "../../config/types.js";
import { resolvecrocbotAgentDir } from "../agent-paths.js";
import { DEFAULT_CONTEXT_TOKENS } from "../defaults.js";
import { normalizeModelCompat } from "../model-compat.js";
import { normalizeProviderId } from "../model-selection.js";

// pi-ai's built-in catalog can lag behind crocbot's defaults/docs.
// Add forward-compat fallbacks for known-new IDs by cloning an older template model.

type ForwardCompatSpec = {
  provider: string;
  /** Model ID stems that match the new model (e.g., ["claude-opus-4-6", "claude-opus-4.6"]). */
  stems: readonly string[];
  /** Replacement mappings: stem -> template stem for deriving template IDs. */
  replacements?: ReadonlyArray<readonly [string, string]>;
  /** Fallback template IDs to try after replacements. */
  templateIds: readonly string[];
};

/**
 * Shared forward-compat model resolution: checks if `modelId` matches any stem,
 * derives template IDs from replacements and fallbacks, clones the first match.
 */
function resolveForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ReturnType<typeof discoverModels>,
  spec: ForwardCompatSpec,
): Model<Api> | undefined {
  if (normalizeProviderId(provider) !== spec.provider) {
    return undefined;
  }
  const trimmedModelId = modelId.trim();
  const lower = trimmedModelId.toLowerCase();
  const matches = spec.stems.some((stem) => lower === stem || lower.startsWith(`${stem}-`));
  if (!matches) {
    return undefined;
  }

  const candidates: string[] = [];
  for (const [from, to] of spec.replacements ?? []) {
    if (lower.startsWith(from)) {
      candidates.push(lower.replace(from, to));
    }
  }
  candidates.push(...spec.templateIds);

  for (const templateId of [...new Set(candidates)].filter(Boolean)) {
    const template = modelRegistry.find(spec.provider, templateId) as Model<Api> | null;
    if (template) {
      return normalizeModelCompat({
        ...template,
        id: trimmedModelId,
        name: trimmedModelId,
      } as Model<Api>);
    }
  }
  return undefined;
}

const ANTHROPIC_OPUS_46_SPEC: ForwardCompatSpec = {
  provider: "anthropic",
  stems: ["claude-opus-4-6", "claude-opus-4.6"],
  replacements: [
    ["claude-opus-4-6", "claude-opus-4-5"],
    ["claude-opus-4.6", "claude-opus-4.5"],
  ],
  templateIds: ["claude-opus-4-5", "claude-opus-4.5"],
};

const ANTHROPIC_SONNET_46_SPEC: ForwardCompatSpec = {
  provider: "anthropic",
  stems: ["claude-sonnet-4-6", "claude-sonnet-4.6"],
  replacements: [
    ["claude-sonnet-4-6", "claude-sonnet-4-5"],
    ["claude-sonnet-4.6", "claude-sonnet-4.5"],
  ],
  templateIds: ["claude-sonnet-4-5", "claude-sonnet-4.5"],
};

const ANTIGRAVITY_OPUS_46_SPEC: ForwardCompatSpec = {
  provider: "google-antigravity",
  stems: ["claude-opus-4-6", "claude-opus-4.6"],
  templateIds: ["claude-opus-4-5-thinking", "claude-opus-4-5"],
};

type InlineModelEntry = ModelDefinitionConfig & { provider: string };

export function buildInlineProviderModels(
  providers: Record<string, { models?: ModelDefinitionConfig[] }>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) {
      return [];
    }
    return (entry?.models ?? []).map((model) => ({ ...model, provider: trimmed }));
  });
}

export function buildModelAliasLines(cfg?: crocbotConfig) {
  const models = cfg?.agents?.defaults?.models ?? {};
  const entries: Array<{ alias: string; model: string }> = [];
  for (const [keyRaw, entryRaw] of Object.entries(models)) {
    const model = String(keyRaw ?? "").trim();
    if (!model) {
      continue;
    }
    const alias = String((entryRaw as { alias?: string } | undefined)?.alias ?? "").trim();
    if (!alias) {
      continue;
    }
    entries.push({ alias, model });
  }
  return entries
    .toSorted((a, b) => a.alias.localeCompare(b.alias))
    .map((entry) => `- ${entry.alias}: ${entry.model}`);
}

export function resolveModel(
  provider: string,
  modelId: string,
  agentDir?: string,
  cfg?: crocbotConfig,
): {
  model?: Model<Api>;
  error?: string;
  authStorage: ReturnType<typeof discoverAuthStorage>;
  modelRegistry: ReturnType<typeof discoverModels>;
} {
  const resolvedAgentDir = agentDir ?? resolvecrocbotAgentDir();
  const authStorage = discoverAuthStorage(resolvedAgentDir);
  const modelRegistry = discoverModels(authStorage, resolvedAgentDir);
  const model = modelRegistry.find(provider, modelId) as Model<Api> | null;
  if (!model) {
    const providers = cfg?.models?.providers ?? {};
    const inlineModels = buildInlineProviderModels(providers);
    const normalizedProvider = normalizeProviderId(provider);
    const inlineMatch = inlineModels.find(
      (entry) => normalizeProviderId(entry.provider) === normalizedProvider && entry.id === modelId,
    );
    if (inlineMatch) {
      const normalized = normalizeModelCompat(inlineMatch as Model<Api>);
      return {
        model: normalized,
        authStorage,
        modelRegistry,
      };
    }
    const FORWARD_COMPAT_SPECS = [
      ANTHROPIC_OPUS_46_SPEC,
      ANTHROPIC_SONNET_46_SPEC,
      ANTIGRAVITY_OPUS_46_SPEC,
    ];
    for (const spec of FORWARD_COMPAT_SPECS) {
      const forwardCompat = resolveForwardCompatModel(provider, modelId, modelRegistry, spec);
      if (forwardCompat) {
        return { model: forwardCompat, authStorage, modelRegistry };
      }
    }
    const providerCfg = providers[provider];
    if (providerCfg || modelId.startsWith("mock-")) {
      const fallbackModel: Model<Api> = normalizeModelCompat({
        id: modelId,
        name: modelId,
        api: providerCfg?.api ?? "openai-responses",
        provider,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: providerCfg?.models?.[0]?.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
        maxTokens: providerCfg?.models?.[0]?.maxTokens ?? DEFAULT_CONTEXT_TOKENS,
      } as Model<Api>);
      return { model: fallbackModel, authStorage, modelRegistry };
    }
    return {
      error: `Unknown model: ${provider}/${modelId}`,
      authStorage,
      modelRegistry,
    };
  }
  return { model: normalizeModelCompat(model), authStorage, modelRegistry };
}
