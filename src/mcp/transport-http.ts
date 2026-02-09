import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { validateMcpUrl, createGuardedFetch } from "./transport-ssrf.js";
import type { McpServerConfig } from "./types.js";

/** Dependencies injected for testability. */
export interface HttpTransportDeps {
  validateUrl: typeof validateMcpUrl;
  createFetch: typeof createGuardedFetch;
}

function createDefaultDeps(): HttpTransportDeps {
  return { validateUrl: validateMcpUrl, createFetch: createGuardedFetch };
}

/**
 * Create a streamable HTTP transport with SSRF validation and custom header support.
 *
 * Validates the server URL against SSRF policy before constructing the
 * SDK transport. Injects a guarded fetch so redirects are also validated.
 */
export async function createHttpTransport(
  config: McpServerConfig,
  deps: HttpTransportDeps = createDefaultDeps(),
): Promise<Transport> {
  if (!config.url) {
    throw new Error("HTTP transport requires a url");
  }

  const url = await deps.validateUrl(config.url);
  const guardedFetch = deps.createFetch();

  const requestInit: RequestInit = {};

  if (config.headers && Object.keys(config.headers).length > 0) {
    requestInit.headers = { ...config.headers };
  }

  return new StreamableHTTPClientTransport(url, {
    requestInit,
    fetch: guardedFetch,
  });
}
