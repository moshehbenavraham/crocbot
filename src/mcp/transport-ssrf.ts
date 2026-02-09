import {
  resolvePinnedHostnameWithPolicy,
  type LookupFn,
  type SsrFPolicy,
} from "../infra/net/ssrf.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";

/** Dependencies injected for testability. */
export interface SsrfValidationDeps {
  resolvePinned: typeof resolvePinnedHostnameWithPolicy;
}

function createDefaultSsrfDeps(): SsrfValidationDeps {
  return { resolvePinned: resolvePinnedHostnameWithPolicy };
}

/**
 * Validate an MCP server URL against SSRF policy.
 *
 * Parses the URL, resolves DNS, and rejects private/internal addresses.
 * Must be called before constructing any remote SDK transport.
 */
export async function validateMcpUrl(
  url: string,
  params: { lookupFn?: LookupFn; policy?: SsrFPolicy; deps?: SsrfValidationDeps } = {},
): Promise<URL> {
  const deps = params.deps ?? createDefaultSsrfDeps();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid MCP server URL: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid MCP server URL protocol: ${parsed.protocol}`);
  }

  await deps.resolvePinned(parsed.hostname, {
    lookupFn: params.lookupFn,
    policy: params.policy,
  });

  return parsed;
}

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Create a fetch wrapper that validates each request URL against SSRF policy.
 *
 * Injected into SDK transport constructors so that redirects followed by the
 * SDK are also validated against private/internal addresses.
 */
export function createGuardedFetch(
  params: { lookupFn?: LookupFn; policy?: SsrFPolicy } = {},
): FetchLike {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const result = await fetchWithSsrFGuard({
      url,
      init,
      lookupFn: params.lookupFn,
      policy: params.policy,
    });
    return result.response;
  };
}
