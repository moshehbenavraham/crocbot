import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { validateMcpUrl, createGuardedFetch } from "./transport-ssrf.js";
import type { McpServerConfig } from "./types.js";

/** Dependencies injected for testability. */
export interface SseTransportDeps {
  validateUrl: typeof validateMcpUrl;
  createFetch: typeof createGuardedFetch;
}

function createDefaultDeps(): SseTransportDeps {
  return { validateUrl: validateMcpUrl, createFetch: createGuardedFetch };
}

/**
 * Create an SSE transport with SSRF validation and custom header support.
 *
 * Validates the server URL against SSRF policy before constructing the
 * SDK transport. Injects a guarded fetch so redirects are also validated.
 */
export async function createSseTransport(
  config: McpServerConfig,
  deps: SseTransportDeps = createDefaultDeps(),
): Promise<Transport> {
  if (!config.url) {
    throw new Error("SSE transport requires a url");
  }

  const url = await deps.validateUrl(config.url);
  const guardedFetch = deps.createFetch();

  const requestInit: RequestInit = {};
  const eventSourceInit: Record<string, unknown> = {};

  if (config.headers && Object.keys(config.headers).length > 0) {
    requestInit.headers = { ...config.headers };
    eventSourceInit.headers = { ...config.headers };
  }

  return new SSEClientTransport(url, {
    requestInit,
    eventSourceInit,
    fetch: guardedFetch,
  });
}
