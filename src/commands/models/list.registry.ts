import type { Api, Model } from "@mariozechner/pi-ai";
import { discoverAuthStorage, discoverModels } from "../../agents/pi-model-discovery.js";

import { resolvecrocbotAgentDir } from "../../agents/agent-paths.js";
import type { AuthProfileStore } from "../../agents/auth-profiles.js";
import { listProfilesForProvider } from "../../agents/auth-profiles.js";
import {
  getCustomProviderApiKey,
  resolveAwsSdkEnvVarName,
  resolveEnvApiKey,
} from "../../agents/model-auth.js";
import { ensurecrocbotModelsJson } from "../../agents/models-config.js";
import type { crocbotConfig } from "../../config/config.js";
import type { ModelRow } from "./list.types.js";
import { modelKey } from "./shared.js";

const isLocalBaseUrl = (baseUrl: string) => {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
};

const hasAuthForProvider = (provider: string, cfg: crocbotConfig, authStore: AuthProfileStore) => {
  if (listProfilesForProvider(authStore, provider).length > 0) {
    return true;
  }
  if (provider === "amazon-bedrock" && resolveAwsSdkEnvVarName()) {
    return true;
  }
  if (resolveEnvApiKey(provider)) {
    return true;
  }
  if (getCustomProviderApiKey(cfg, provider)) {
    return true;
  }
  return false;
};

// Supplemental Anthropic models not yet in the SDK catalog.
// Bypassed once the SDK includes the model natively (duplicate check).
const SUPPLEMENTAL_MODELS: Model<Api>[] = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    api: "anthropic-messages",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    contextWindow: 200_000,
    maxTokens: 64_000,
  } as Model<Api>,
];

export async function loadModelRegistry(cfg: crocbotConfig) {
  await ensurecrocbotModelsJson(cfg);
  const agentDir = resolvecrocbotAgentDir();
  const authStorage = discoverAuthStorage(agentDir);
  const registry = discoverModels(authStorage, agentDir);
  const models = registry.getAll();

  // Inject supplemental models not yet in the SDK.
  const existingKeys = new Set(models.map((m) => modelKey(m.provider, m.id)));
  for (const supplemental of SUPPLEMENTAL_MODELS) {
    if (!existingKeys.has(modelKey(supplemental.provider, supplemental.id))) {
      models.push(supplemental);
    }
  }

  const availableModels = registry.getAvailable();
  const availableKeys = new Set(availableModels.map((model) => modelKey(model.provider, model.id)));

  // Mark supplemental models as available if their provider has auth.
  for (const supplemental of SUPPLEMENTAL_MODELS) {
    const key = modelKey(supplemental.provider, supplemental.id);
    if (!availableKeys.has(key)) {
      // Check if any model from the same provider is available.
      const providerAvailable = availableModels.some((m) => m.provider === supplemental.provider);
      if (providerAvailable) {
        availableKeys.add(key);
      }
    }
  }

  return { registry, models, availableKeys };
}

export function toModelRow(params: {
  model?: Model<Api>;
  key: string;
  tags: string[];
  aliases?: string[];
  availableKeys?: Set<string>;
  cfg?: crocbotConfig;
  authStore?: AuthProfileStore;
}): ModelRow {
  const { model, key, tags, aliases = [], availableKeys, cfg, authStore } = params;
  if (!model) {
    return {
      key,
      name: key,
      input: "-",
      contextWindow: null,
      local: null,
      available: null,
      tags: [...tags, "missing"],
      missing: true,
    };
  }

  const input = model.input.join("+") || "text";
  const local = isLocalBaseUrl(model.baseUrl);
  const available =
    cfg && authStore
      ? hasAuthForProvider(model.provider, cfg, authStore)
      : (availableKeys?.has(modelKey(model.provider, model.id)) ?? false);
  const aliasTags = aliases.length > 0 ? [`alias:${aliases.join(",")}`] : [];
  const mergedTags = new Set(tags);
  if (aliasTags.length > 0) {
    for (const tag of mergedTags) {
      if (tag === "alias" || tag.startsWith("alias:")) {
        mergedTags.delete(tag);
      }
    }
    for (const tag of aliasTags) {
      mergedTags.add(tag);
    }
  }

  return {
    key,
    name: model.name || model.id,
    input,
    contextWindow: model.contextWindow ?? null,
    local,
    available,
    tags: Array.from(mergedTags),
    missing: false,
  };
}
