/**
 * LLM-specific retry policy with transient error classification.
 *
 * Provides a `shouldRetry` + `retryAfterMs` strategy for the existing
 * `retryAsync()` utility in `src/infra/retry.ts`. Classifies LLM API errors
 * as transient (retryable) or permanent, and parses Retry-After headers
 * from provider responses.
 *
 * This module does NOT replace `src/infra/retry.ts` -- it creates an
 * LLM-specific options preset that composes with `retryAsync()`.
 *
 * Created via `createLlmRetryOptions(overrides?)`.
 */

import type { RetryOptions } from "./retry.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HTTP status codes classified as transient (retryable). */
const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** HTTP status codes classified as permanent (non-retryable). */
const PERMANENT_STATUS_CODES = new Set([400, 401, 403, 404, 422]);

/** Network error codes classified as transient (retryable). */
const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "ESOCKETTIMEDOUT",
  "ECONNABORTED",
]);

/** Default LLM retry configuration. */
const LLM_RETRY_DEFAULTS = {
  attempts: 3,
  minDelayMs: 300,
  maxDelayMs: 30_000,
  jitter: 0.25,
} as const;

// ---------------------------------------------------------------------------
// Error property extraction helpers
// ---------------------------------------------------------------------------

/** Extract HTTP status code from an error object. */
function getStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const candidate =
    (err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === "string" && /^\d+$/.test(candidate)) {
    return Number(candidate);
  }
  return undefined;
}

/** Extract error code string (e.g. "ECONNRESET") from an error object. */
function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const candidate = (err as { code?: unknown }).code;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Transient error classification
// ---------------------------------------------------------------------------

/**
 * Classify whether an LLM API error is transient (retryable).
 *
 * Classification rules:
 * 1. Status 408, 429, 500, 502, 503, 504 -> retryable
 * 2. Status 400, 401, 403, 404, 422 -> NOT retryable
 * 3. Network errors (ECONNRESET, ETIMEDOUT, etc.) -> retryable
 * 4. No status code and no network code -> NOT retryable (safe default)
 *
 * @param err - The error to classify.
 * @returns true if the error is transient and should be retried.
 */
export function isTransientLlmError(err: unknown): boolean {
  const status = getStatusCode(err);
  if (status !== undefined) {
    if (TRANSIENT_STATUS_CODES.has(status)) {
      return true;
    }
    if (PERMANENT_STATUS_CODES.has(status)) {
      return false;
    }
  }

  const code = getErrorCode(err);
  if (code && TRANSIENT_NETWORK_CODES.has(code.toUpperCase())) {
    return true;
  }

  // Check cause chain for network errors.
  if (err && typeof err === "object" && "cause" in err) {
    const cause = (err as { cause?: unknown }).cause;
    const causeCode = getErrorCode(cause);
    if (causeCode && TRANSIENT_NETWORK_CODES.has(causeCode.toUpperCase())) {
      return true;
    }
  }

  // Safe default: no status, no recognized network code -> non-retryable.
  return false;
}

// ---------------------------------------------------------------------------
// Retry-After header parsing
// ---------------------------------------------------------------------------

/**
 * Parse the Retry-After value from an LLM API error or response.
 *
 * Looks for the Retry-After header in multiple locations on the error object:
 * - `err.response?.headers?.["retry-after"]`
 * - `err.headers?.["retry-after"]`
 * - `err.retryAfterMs` (pre-parsed by some SDKs)
 *
 * Supports both formats:
 * - Relative seconds: `Retry-After: 30` -> 30000ms
 * - HTTP-date: `Retry-After: Thu, 10 Feb 2026 12:00:00 GMT` -> delta ms
 *
 * @param err - The error to extract Retry-After from.
 * @param maxDelayMs - Maximum allowed delay (caps the result). Defaults to 30000.
 * @returns Milliseconds to wait, or undefined if no valid Retry-After found.
 */
export function parseLlmRetryAfter(
  err: unknown,
  maxDelayMs: number = LLM_RETRY_DEFAULTS.maxDelayMs,
): number | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }

  // Check for pre-parsed retryAfterMs.
  const preParsed = (err as { retryAfterMs?: unknown }).retryAfterMs;
  if (typeof preParsed === "number" && Number.isFinite(preParsed) && preParsed > 0) {
    return Math.min(preParsed, maxDelayMs);
  }

  // Extract raw Retry-After header value.
  const raw = extractRetryAfterHeader(err);
  if (raw === undefined) {
    return undefined;
  }

  return parseRetryAfterValue(raw, maxDelayMs);
}

/** Extract the raw Retry-After header string from an error object. */
function extractRetryAfterHeader(err: unknown): string | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }

  // err.response?.headers?.["retry-after"]
  const response = (err as { response?: unknown }).response;
  if (response && typeof response === "object") {
    const headers = (response as { headers?: unknown }).headers;
    const value = getHeaderValue(headers, "retry-after");
    if (value !== undefined) {
      return value;
    }
  }

  // err.headers?.["retry-after"]
  const headers = (err as { headers?: unknown }).headers;
  const value = getHeaderValue(headers, "retry-after");
  if (value !== undefined) {
    return value;
  }

  return undefined;
}

/** Get a header value from a headers object (case-insensitive key lookup). */
function getHeaderValue(headers: unknown, key: string): string | undefined {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  // Handle Map-like (e.g. Headers API).
  if (typeof (headers as { get?: unknown }).get === "function") {
    const value = (headers as { get: (k: string) => unknown }).get(key);
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    return undefined;
  }

  // Handle plain object.
  const record = headers as Record<string, unknown>;
  for (const [k, v] of Object.entries(record)) {
    if (k.toLowerCase() === key.toLowerCase() && typeof v === "string" && v.length > 0) {
      return v;
    }
  }

  return undefined;
}

/**
 * Parse a raw Retry-After value (seconds or HTTP-date) into milliseconds.
 * Returns undefined for zero, negative, or unparseable values.
 */
function parseRetryAfterValue(raw: string, maxDelayMs: number): number | undefined {
  const trimmed = raw.trim();

  // Try numeric seconds first.
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    if (seconds <= 0) {
      return undefined;
    }
    const ms = seconds * 1000;
    return Math.min(ms, maxDelayMs);
  }

  // Try HTTP-date format.
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    const deltaMs = dateMs - Date.now();
    if (deltaMs <= 0) {
      return undefined;
    }
    return Math.min(deltaMs, maxDelayMs);
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// LLM retry options factory
// ---------------------------------------------------------------------------

/** Options for configuring the LLM retry policy. */
export interface LlmRetryOverrides {
  /** Maximum number of retry attempts. Default: 3. */
  attempts?: number;
  /** Minimum delay between retries in ms. Default: 300. */
  minDelayMs?: number;
  /** Maximum delay between retries in ms. Default: 30000. */
  maxDelayMs?: number;
  /** Jitter factor (0-1). Default: 0.25. */
  jitter?: number;
  /** Optional label for logging. */
  label?: string;
  /** Optional callback invoked before each retry. */
  onRetry?: RetryOptions["onRetry"];
}

/**
 * Create a RetryOptions preset configured for LLM API calls.
 *
 * The returned options can be passed directly to `retryAsync()`:
 * ```ts
 * const result = await retryAsync(callLlm, createLlmRetryOptions({ label: "chat" }));
 * ```
 *
 * @param overrides - Optional partial overrides for retry behavior.
 * @returns RetryOptions configured with LLM-specific error classification.
 */
export function createLlmRetryOptions(overrides?: LlmRetryOverrides): RetryOptions {
  const maxDelay = overrides?.maxDelayMs ?? LLM_RETRY_DEFAULTS.maxDelayMs;

  return {
    attempts: overrides?.attempts ?? LLM_RETRY_DEFAULTS.attempts,
    minDelayMs: overrides?.minDelayMs ?? LLM_RETRY_DEFAULTS.minDelayMs,
    maxDelayMs: maxDelay,
    jitter: overrides?.jitter ?? LLM_RETRY_DEFAULTS.jitter,
    label: overrides?.label,
    onRetry: overrides?.onRetry,
    shouldRetry: (err: unknown, _attempt: number): boolean => {
      return isTransientLlmError(err);
    },
    retryAfterMs: (err: unknown): number | undefined => {
      return parseLlmRetryAfter(err, maxDelay);
    },
  };
}
