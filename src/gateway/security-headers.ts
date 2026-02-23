/**
 * Application-level security headers and basic WAF request filtering
 * for the gateway HTTP server.
 *
 * Provides hardened response headers and rejects malformed/malicious
 * requests before they reach route handlers.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

/** Maximum URL length before the request is rejected. */
const MAX_URL_LENGTH = 8192;

/**
 * Apply security headers to every HTTP response.
 *
 * These are safe defaults for an API server that does not serve HTML.
 */
export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  // Remove server identity header if present
  res.removeHeader("X-Powered-By");
}

export interface RequestFilterResult {
  blocked: boolean;
  status?: number;
  message?: string;
}

/**
 * Inspect an incoming request for common attack patterns.
 *
 * Returns `{ blocked: false }` when the request looks safe, or
 * `{ blocked: true, status, message }` when it should be rejected.
 */
export function filterRequest(req: IncomingMessage): RequestFilterResult {
  const url = req.url ?? "";

  // Reject oversized URLs (potential buffer-overflow / DoS vector)
  if (url.length > MAX_URL_LENGTH) {
    return { blocked: true, status: 414, message: "URI Too Long" };
  }

  // Reject null bytes in URL (classic path injection)
  if (url.includes("\0")) {
    return { blocked: true, status: 400, message: "Bad Request" };
  }

  // Reject path traversal attempts
  if (url.includes("../") || url.includes("..\\")) {
    return { blocked: true, status: 400, message: "Bad Request" };
  }

  return { blocked: false };
}
