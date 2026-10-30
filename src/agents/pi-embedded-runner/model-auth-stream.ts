import type { StreamFn } from "@earendil-works/pi-agent-core";
import { streamSimple } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

type ModelAuthSource = Pick<ModelRegistry, "getApiKeyAndHeaders">;

/** Merge header maps; later names replace earlier ones regardless of case. */
export function mergeHeaders(
  ...sources: Array<Record<string, string> | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};
  const nameByLower = new Map<string, string>();
  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const [name, value] of Object.entries(source)) {
      const lower = name.toLowerCase();
      const previous = nameByLower.get(lower);
      if (previous !== undefined) {
        delete merged[previous];
      }
      nameByLower.set(lower, name);
      merged[name] = value;
    }
  }
  return merged;
}

/**
 * Wrap a stream function so every request carries the model's resolved API key
 * and request headers, matching pi's default `streamFn` (pi >=0.74 only applies
 * them there, and crocbot replaces that function).
 *
 * - The key comes from `getApiKeyAndHeaders`, which reads the auth storage first,
 *   so a per-attempt runtime key (`authStorage.setRuntimeApiKey`) still wins.
 * - Headers merge in pi's order: model/provider/models.json headers (plus
 *   `Authorization: Bearer <key>` when the provider sets `authHeader: true`),
 *   then any headers passed by outer wrappers in `options.headers`. Header names
 *   compare case-insensitively, so an override replaces e.g. `Authorization`
 *   even when spelled `authorization` instead of sending both.
 * - Provider env from auth storage is merged under `options.env` the same way.
 */
export function createModelAuthStreamFn(
  modelRegistry: ModelAuthSource,
  baseStreamFn: StreamFn = streamSimple,
): StreamFn {
  return async (model, context, options) => {
    const auth = await modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) {
      throw new Error(auth.error);
    }
    const headers =
      auth.headers || options?.headers ? mergeHeaders(auth.headers, options?.headers) : undefined;
    const env = auth.env || options?.env ? { ...auth.env, ...options?.env } : undefined;
    return baseStreamFn(model, context, {
      ...options,
      apiKey: auth.apiKey ?? options?.apiKey,
      headers,
      env,
    });
  };
}
