/**
 * Deep/recursive redaction for config objects.
 * Masks sensitive values (API keys, tokens, passwords, secrets) while preserving structure.
 */

const REDACTED_MARKER = "[REDACTED]";

/**
 * Key patterns that indicate sensitive values requiring redaction.
 * Matches are case-insensitive.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  // API keys and tokens
  /apiKey$/i,
  /^apiKey$/i,
  /api[-_]?key/i,
  /token$/i,
  /^token$/i,
  /^botToken$/i,
  /^accessToken$/i,
  /^refreshToken$/i,
  /^bearerToken$/i,
  /^authToken$/i,
  /^idToken$/i,
  // Passwords and secrets
  /password/i,
  /passwd/i,
  /secret/i,
  /^webhookSecret$/i,
  // Credentials
  /credential/i,
  /private[-_]?key/i,
  // Auth-related
  /^auth$/i,
  // Proxy URLs (may contain credentials)
  /^proxy$/i,
];

/**
 * Specific key paths that should always be redacted.
 * Format: "parent.child" or just "key" for any level.
 */
const SENSITIVE_KEY_EXACT: Set<string> = new Set([
  "botToken",
  "apiKey",
  "token",
  "password",
  "secret",
  "webhookSecret",
  "accessToken",
  "refreshToken",
  "bearerToken",
  "authToken",
  "idToken",
  "proxy",
  "sshIdentity",
  "tlsFingerprint",
]);

/**
 * Keys that contain nested objects with sensitive data.
 * These are recursively redacted but structure is preserved.
 */
const _SENSITIVE_NESTED_KEYS: Set<string> = new Set(["auth", "remote", "tls"]);

/**
 * Determines if a key name indicates a sensitive value.
 */
function isSensitiveKey(key: string): boolean {
  // Check exact matches first
  if (SENSITIVE_KEY_EXACT.has(key)) {
    return true;
  }

  // Check pattern matches
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Determines if a value looks like it might be a secret (heuristic).
 * This catches cases where the key name doesn't clearly indicate sensitivity.
 */
function looksLikeSecret(value: string): boolean {
  // Skip empty or very short strings
  if (value.length < 8) {
    return false;
  }

  // Check for common API key patterns
  const secretPatterns = [
    /^sk-[A-Za-z0-9_-]+$/, // OpenAI-style
    /^ghp_[A-Za-z0-9]+$/, // GitHub PAT
    /^github_pat_[A-Za-z0-9_]+$/, // GitHub PAT new
    /^xox[baprs]-[A-Za-z0-9-]+$/, // Slack tokens
    /^xapp-[A-Za-z0-9-]+$/, // Slack app tokens
    /^gsk_[A-Za-z0-9_-]+$/, // Groq API keys
    /^AIza[0-9A-Za-z\-_]+$/, // Google API keys
    /^pplx-[A-Za-z0-9_-]+$/, // Perplexity API keys
    /^\d{6,}:[A-Za-z0-9_-]{20,}$/, // Telegram bot tokens
    /^-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private keys
  ];

  return secretPatterns.some((pattern) => pattern.test(value));
}

/**
 * Redacts a single value if it appears to be sensitive.
 */
function redactValue(value: unknown, key: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    // Always redact if key is sensitive
    if (isSensitiveKey(key)) {
      return value.length > 0 ? REDACTED_MARKER : value;
    }
    // Also redact if the value looks like a secret
    if (looksLikeSecret(value)) {
      return REDACTED_MARKER;
    }
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(item, `${key}[${index}]`));
  }

  if (typeof value === "object") {
    return redactConfigObject(value as Record<string, unknown>);
  }

  return value;
}

/**
 * Recursively redacts sensitive values in a config object.
 * Preserves the object structure while masking sensitive data.
 */
export function redactConfigObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = redactValue(value, key);
  }

  return result as T;
}

/**
 * Redacts a ConfigFileSnapshot's sensitive fields.
 * The `raw` field is completely redacted as it contains the raw config text.
 * The `parsed` and `config` objects are deeply redacted.
 */
export function redactConfigSnapshot<
  T extends {
    raw?: string | null;
    parsed?: unknown;
    config?: Record<string, unknown>;
  },
>(snapshot: T): T {
  const result = { ...snapshot };

  // Redact raw config text completely (contains all secrets in plain text)
  if (typeof result.raw === "string" && result.raw.length > 0) {
    result.raw = REDACTED_MARKER;
  }

  // Redact parsed object (pre-validation config)
  if (result.parsed && typeof result.parsed === "object" && !Array.isArray(result.parsed)) {
    result.parsed = redactConfigObject(result.parsed as Record<string, unknown>);
  }

  // Redact validated config object
  if (result.config && typeof result.config === "object") {
    result.config = redactConfigObject(result.config);
  }

  return result;
}

/**
 * List of sensitive key patterns for documentation/testing.
 */
export function getSensitiveKeyPatterns(): string[] {
  return SENSITIVE_KEY_PATTERNS.map((p) => p.source);
}

/**
 * List of exact sensitive keys for documentation/testing.
 */
export function getSensitiveExactKeys(): string[] {
  return [...SENSITIVE_KEY_EXACT];
}
