import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

/**
 * Extract a Bearer token from the Authorization header of an HTTP request.
 * Returns `undefined` when the header is missing or not in "Bearer <token>" format.
 */
export function extractBearerToken(req: IncomingMessage): string | undefined {
  const raw = req.headers.authorization;
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }
  const token = trimmed.slice(7).trim();
  return token || undefined;
}

/**
 * Timing-safe comparison of two token strings.
 * Returns `false` when either value is empty or when lengths differ.
 */
export function validateToken(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) {
    return false;
  }
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

/**
 * Validate an inbound MCP server request.
 * Returns `true` when the request carries a valid Bearer token matching `expected`.
 */
export function authenticateMcpRequest(req: IncomingMessage, expectedToken: string): boolean {
  const provided = extractBearerToken(req);
  return validateToken(provided, expectedToken);
}
