import crypto from "node:crypto";

import type { WebhookContext } from "./types.js";

/**
 * Validate Twilio webhook signature using HMAC-SHA1.
 *
 * Twilio signs requests by concatenating the URL with sorted POST params,
 * then computing HMAC-SHA1 with the auth token.
 *
 * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function validateTwilioSignature(
  authToken: string,
  signature: string | undefined,
  url: string,
  params: URLSearchParams,
): boolean {
  if (!signature) {
    return false;
  }

  // Build the string to sign: URL + sorted params (key+value pairs)
  let dataToSign = url;

  // Sort params alphabetically and append key+value
  const sortedParams = Array.from(params.entries()).toSorted((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  );

  for (const [key, value] of sortedParams) {
    dataToSign += key + value;
  }

  // HMAC-SHA1 with auth token, then base64 encode
  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(dataToSign)
    .digest("base64");

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(signature, expectedSignature);
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to maintain constant time
    const dummy = Buffer.from(a);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Configuration for secure URL reconstruction.
 */
export interface WebhookUrlOptions {
  /**
   * Whitelist of allowed hostnames. If provided, only these hosts will be
   * accepted from forwarding headers. This prevents host header injection attacks.
   *
   * SECURITY: You must provide this OR set trustForwardingHeaders=true to use
   * X-Forwarded-Host headers. Without either, forwarding headers are ignored.
   */
  allowedHosts?: string[];
  /**
   * Explicitly trust X-Forwarded-* headers without a whitelist.
   * WARNING: Only set this to true if you trust your proxy configuration
   * and understand the security implications.
   *
   * @default false
   */
  trustForwardingHeaders?: boolean;
  /**
   * List of trusted proxy IP addresses. X-Forwarded-* headers will only be
   * trusted if the request comes from one of these IPs.
   * Requires remoteIP to be set for validation.
   */
  trustedProxyIPs?: string[];
  /**
   * The IP address of the incoming request (for proxy validation).
   */
  remoteIP?: string;
}

/**
 * Validate that a hostname matches RFC 1123 format.
 * Prevents injection of malformed hostnames.
 */
function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  // RFC 1123 hostname: alphanumeric, hyphens, dots
  // Also allow ngrok/tunnel subdomains
  const hostnameRegex =
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return hostnameRegex.test(hostname);
}

/**
 * Safely extract hostname from a host header value.
 * Handles IPv6 addresses and prevents injection via malformed values.
 */
function extractHostname(hostHeader: string): string | null {
  if (!hostHeader) return null;

  let hostname: string;

  // Handle IPv6 addresses: [::1]:8080
  if (hostHeader.startsWith("[")) {
    const endBracket = hostHeader.indexOf("]");
    if (endBracket === -1) return null; // Malformed IPv6
    hostname = hostHeader.substring(1, endBracket);
    return hostname.toLowerCase();
  }

  // Handle IPv4/domain with optional port
  // Check for @ which could indicate user info injection attempt
  if (hostHeader.includes("@")) return null; // Reject potential injection: attacker.com:80@legitimate.com

  hostname = hostHeader.split(":")[0];

  // Validate the extracted hostname
  if (!isValidHostname(hostname)) return null;

  return hostname.toLowerCase();
}

function extractHostnameFromHeader(headerValue: string): string | null {
  const first = headerValue.split(",")[0]?.trim();
  if (!first) return null;
  return extractHostname(first);
}

function normalizeAllowedHosts(allowedHosts?: string[]): Set<string> | null {
  if (!allowedHosts || allowedHosts.length === 0) return null;
  const normalized = new Set<string>();
  for (const host of allowedHosts) {
    const extracted = extractHostname(host.trim());
    if (extracted) normalized.add(extracted);
  }
  return normalized.size > 0 ? normalized : null;
}

/**
 * Reconstruct the public webhook URL from request headers.
 *
 * SECURITY: This function validates host headers to prevent host header
 * injection attacks. When using forwarding headers (X-Forwarded-Host, etc.),
 * always provide allowedHosts to whitelist valid hostnames.
 *
 * When behind a reverse proxy (Tailscale, nginx, ngrok), the original URL
 * used by Twilio differs from the local request URL. We use standard
 * forwarding headers to reconstruct it.
 *
 * Priority order:
 * 1. X-Forwarded-Proto + X-Forwarded-Host (standard proxy headers)
 * 2. X-Original-Host (nginx)
 * 3. Ngrok-Forwarded-Host (ngrok specific)
 * 4. Host header (direct connection)
 */
export function reconstructWebhookUrl(ctx: WebhookContext, options?: WebhookUrlOptions): string {
  const { headers } = ctx;

  // SECURITY: Only trust forwarding headers if explicitly configured.
  // Either allowedHosts must be set (for whitelist validation) or
  // trustForwardingHeaders must be true (explicit opt-in to trust).
  const allowedHosts = normalizeAllowedHosts(options?.allowedHosts);
  const hasAllowedHosts = allowedHosts !== null;
  const explicitlyTrusted = options?.trustForwardingHeaders === true;

  // Also check trusted proxy IPs if configured
  const trustedProxyIPs = options?.trustedProxyIPs?.filter(Boolean) ?? [];
  const hasTrustedProxyIPs = trustedProxyIPs.length > 0;
  const remoteIP = options?.remoteIP ?? ctx.remoteAddress;
  const fromTrustedProxy =
    !hasTrustedProxyIPs || (remoteIP ? trustedProxyIPs.includes(remoteIP) : false);

  // Only trust forwarding headers if: (has whitelist OR explicitly trusted) AND from trusted proxy
  const shouldTrustForwardingHeaders = (hasAllowedHosts || explicitlyTrusted) && fromTrustedProxy;

  const isAllowedForwardedHost = (host: string): boolean =>
    !allowedHosts || allowedHosts.has(host);

  // Determine protocol - only trust X-Forwarded-Proto from trusted proxies
  let proto = "https";
  if (shouldTrustForwardingHeaders) {
    const forwardedProto = getHeader(headers, "x-forwarded-proto");
    if (forwardedProto === "http" || forwardedProto === "https") {
      proto = forwardedProto;
    }
  }

  // Determine host - with security validation
  let host: string | null = null;

  if (shouldTrustForwardingHeaders) {
    // Try forwarding headers in priority order
    const forwardingHeaders = ["x-forwarded-host", "x-original-host", "ngrok-forwarded-host"];

    for (const headerName of forwardingHeaders) {
      const headerValue = getHeader(headers, headerName);
      if (headerValue) {
        const extracted = extractHostnameFromHeader(headerValue);
        if (extracted && isAllowedForwardedHost(extracted)) {
          host = extracted;
          break;
        }
      }
    }
  }

  // Fallback to Host header if no valid forwarding header found
  if (!host) {
    const hostHeader = getHeader(headers, "host");
    if (hostHeader) {
      const extracted = extractHostnameFromHeader(hostHeader);
      if (extracted) host = extracted;
    }
  }

  // Last resort: try to extract from ctx.url
  if (!host) {
    try {
      const parsed = new URL(ctx.url);
      const extracted = extractHostname(parsed.host);
      if (extracted) host = extracted;
    } catch {
      // URL parsing failed - use empty string (will result in invalid URL)
      host = "";
    }
  }

  if (!host) host = "";

  // Extract path from the context URL (fallback to "/" on parse failure)
  let path = "/";
  try {
    const parsed = new URL(ctx.url);
    path = parsed.pathname + parsed.search;
  } catch {
    // URL parsing failed
  }

  return `${proto}://${host}${path}`;
}

function buildTwilioVerificationUrl(
  ctx: WebhookContext,
  publicUrl?: string,
  urlOptions?: WebhookUrlOptions,
): string {
  if (!publicUrl) {
    return reconstructWebhookUrl(ctx, urlOptions);
  }

  try {
    const base = new URL(publicUrl);
    const requestUrl = new URL(ctx.url);
    base.pathname = requestUrl.pathname;
    base.search = requestUrl.search;
    return base.toString();
  } catch {
    return publicUrl;
  }
}

/**
 * Get a header value, handling both string and string[] types.
 */
function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isLoopbackAddress(address?: string): boolean {
  if (!address) return false;
  if (address === "127.0.0.1" || address === "::1") return true;
  if (address.startsWith("::ffff:127.")) return true;
  return false;
}

/**
 * Result of Twilio webhook verification with detailed info.
 */
export interface TwilioVerificationResult {
  ok: boolean;
  reason?: string;
  /** The URL that was used for verification (for debugging) */
  verificationUrl?: string;
  /** Whether we're running behind ngrok free tier */
  isNgrokFreeTier?: boolean;
}

/**
 * Verify Twilio webhook with full context and detailed result.
 *
 * Handles the special case of ngrok free tier where signature validation
 * may fail due to URL discrepancies (ngrok adds interstitial page handling).
 */
export function verifyTwilioWebhook(
  ctx: WebhookContext,
  authToken: string,
  options?: {
    /** Override the public URL (e.g., from config) */
    publicUrl?: string;
    /** Allow ngrok free tier compatibility mode (loopback only, less secure) */
    allowNgrokFreeTierLoopbackBypass?: boolean;
    /** Skip verification entirely (only for development) */
    skipVerification?: boolean;
    /** Whitelist of allowed hostnames for host header validation */
    allowedHosts?: string[];
    /** Explicitly trust X-Forwarded-* headers without a whitelist */
    trustForwardingHeaders?: boolean;
    /** List of trusted proxy IP addresses */
    trustedProxyIPs?: string[];
    /** The remote IP address of the request (for proxy validation) */
    remoteIP?: string;
  },
): TwilioVerificationResult {
  // Allow skipping verification for development/testing
  if (options?.skipVerification) {
    return { ok: true, reason: "verification skipped (dev mode)" };
  }

  const signature = getHeader(ctx.headers, "x-twilio-signature");

  if (!signature) {
    return { ok: false, reason: "Missing X-Twilio-Signature header" };
  }

  const isLoopback = isLoopbackAddress(options?.remoteIP ?? ctx.remoteAddress);
  const allowLoopbackForwarding = options?.allowNgrokFreeTierLoopbackBypass && isLoopback;

  // Reconstruct the URL Twilio used
  const verificationUrl = buildTwilioVerificationUrl(ctx, options?.publicUrl, {
    allowedHosts: options?.allowedHosts,
    trustForwardingHeaders: options?.trustForwardingHeaders || allowLoopbackForwarding,
    trustedProxyIPs: options?.trustedProxyIPs,
    remoteIP: options?.remoteIP,
  });

  // Parse the body as URL-encoded params
  const params = new URLSearchParams(ctx.rawBody);

  // Validate signature
  const isValid = validateTwilioSignature(
    authToken,
    signature,
    verificationUrl,
    params,
  );

  if (isValid) {
    return { ok: true, verificationUrl };
  }

  // Check if this is ngrok free tier - the URL might have different format.
  // Use URL hostname parsing instead of substring matching to prevent spoofing
  // (CodeQL js/incomplete-url-substring-sanitization).
  let isNgrokFreeTier = false;
  try {
    const host = new URL(verificationUrl).hostname;
    isNgrokFreeTier = host.endsWith(".ngrok-free.app") || host.endsWith(".ngrok.io");
  } catch {
    // Invalid URL — not ngrok
  }

  if (
    isNgrokFreeTier &&
    options?.allowNgrokFreeTierLoopbackBypass &&
    isLoopback
  ) {
    console.warn(
      "[voice-call] Twilio signature validation failed (ngrok free tier compatibility, loopback only)",
    );
    return {
      ok: true,
      reason: "ngrok free tier compatibility mode (loopback only)",
      verificationUrl,
      isNgrokFreeTier: true,
    };
  }

  return {
    ok: false,
    reason: `Invalid signature for URL: ${verificationUrl}`,
    verificationUrl,
    isNgrokFreeTier,
  };
}

