import type { AssistantMessage } from "@mariozechner/pi-ai";

import type { crocbotConfig } from "../../config/config.js";
import { formatSandboxToolPolicyBlockedMessage } from "../sandbox.js";
import type { FailoverReason } from "./types.js";

export function isContextOverflowError(errorMessage?: string): boolean {
  if (!errorMessage) {
    return false;
  }
  const lower = errorMessage.toLowerCase();
  const hasRequestSizeExceeds = lower.includes("request size exceeds");
  const hasContextWindow =
    lower.includes("context window") ||
    lower.includes("context length") ||
    lower.includes("maximum context length");
  return (
    lower.includes("request_too_large") ||
    lower.includes("request exceeds the maximum size") ||
    lower.includes("context length exceeded") ||
    lower.includes("maximum context length") ||
    lower.includes("prompt is too long") ||
    lower.includes("exceeds model context window") ||
    (hasRequestSizeExceeds && hasContextWindow) ||
    lower.includes("context overflow:") ||
    (lower.includes("413") && lower.includes("too large"))
  );
}

/**
 * Linear-time check: does the string contain "context window" followed later by
 * one of the target phrases? Replaces a `.*`-based regex to avoid ReDoS.
 */
function matchesContextWindowTooSmall(lower: string): boolean {
  const idx = lower.indexOf("context window");
  if (idx < 0) {
    return false;
  }
  return lower.includes("too small", idx) || lower.includes("minimum is", idx);
}

/** Phrases that indicate context overflow when they appear after "context window". */
const CONTEXT_WINDOW_OVERFLOW_HINTS = [
  "too large",
  "too long",
  "exceed",
  "over",
  "limit",
  "max",
  "maximum",
  "requested",
  "sent",
  "tokens",
] as const;

/** Phrases that indicate context overflow when they appear after "prompt", "request", or "input". */
const PROMPT_OVERFLOW_HINTS = [
  "too large",
  "too long",
  "exceed",
  "over",
  "limit",
  "max",
  "maximum",
] as const;

/**
 * Linear-time heuristic for context overflow errors.
 * Replaces the polynomial CONTEXT_OVERFLOW_HINT_RE regex.
 */
function matchesContextOverflowHint(lower: string): boolean {
  // "context" followed later by "overflow" (anywhere)
  const ctxIdx = lower.indexOf("context");
  if (ctxIdx >= 0 && lower.indexOf("overflow", ctxIdx) >= 0) {
    return true;
  }

  // "context window" followed by overflow-related phrases
  const cwIdx = lower.indexOf("context window");
  if (cwIdx >= 0) {
    if (CONTEXT_WINDOW_OVERFLOW_HINTS.some((hint) => lower.includes(hint, cwIdx))) {
      return true;
    }
  }

  // "prompt", "request", or "input" followed by overflow-related phrases
  for (const prefix of ["prompt", "request", "input"] as const) {
    const pIdx = lower.indexOf(prefix);
    if (pIdx >= 0) {
      if (PROMPT_OVERFLOW_HINTS.some((hint) => lower.includes(hint, pIdx))) {
        return true;
      }
    }
  }

  return false;
}

export function isLikelyContextOverflowError(errorMessage?: string): boolean {
  if (!errorMessage) {
    return false;
  }
  const lower = errorMessage.toLowerCase();
  if (matchesContextWindowTooSmall(lower)) {
    return false;
  }
  // Rate limit errors can match the broad overflow heuristic
  // (e.g., "request reached organization TPD rate limit" matches request + limit).
  // Exclude them before checking context overflow heuristics.
  if (isRateLimitErrorMessage(errorMessage)) {
    return false;
  }
  if (isContextOverflowError(errorMessage)) {
    return true;
  }
  return matchesContextOverflowHint(lower);
}

export function isCompactionFailureError(errorMessage?: string): boolean {
  if (!errorMessage) {
    return false;
  }
  // Use the heuristic check (isLikelyContextOverflowError) instead of the strict
  // check (isContextOverflowError) because compaction errors come from internal
  // code paths that may include "context overflow" without the colon-prefix format.
  if (!isLikelyContextOverflowError(errorMessage)) {
    return false;
  }
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("summarization failed") ||
    lower.includes("auto-compaction") ||
    lower.includes("compaction failed") ||
    lower.includes("compaction")
  );
}

const ERROR_PAYLOAD_PREFIX_RE =
  /^(?:error|api\s*error|apierror|openai\s*error|anthropic\s*error|gateway\s*error)[:\s-]+/i;
// ReDoS-safe: merged adjacent \s* groups that overlapped when \/? was absent.
// Now: optional whitespace, optional /, optional whitespace — each slot is distinct.
const FINAL_TAG_RE = /<\s*(?:\/\s*)?final\s*>/gi;
const ERROR_PREFIX_RE =
  /^(?:error|api\s*error|openai\s*error|anthropic\s*error|gateway\s*error|request failed|failed|exception)[:\s-]+/i;
const HTTP_STATUS_PREFIX_RE = /^(?:http\s*)?(\d{3})\s+(.+)$/i;
const HTTP_STATUS_CODE_PREFIX_RE = /^(?:http\s*)?(\d{3})(?:\s+([\s\S]+))?$/i;
const HTML_ERROR_PREFIX_RE = /^\s*(?:<!doctype\s+html\b|<html\b)/i;
const CLOUDFLARE_HTML_ERROR_CODES = new Set([521, 522, 523, 524, 525, 526, 530]);
const TRANSIENT_HTTP_ERROR_CODES = new Set([500, 502, 503, 521, 522, 523, 524, 529]);
const HTTP_ERROR_HINTS = [
  "error",
  "bad request",
  "not found",
  "unauthorized",
  "forbidden",
  "internal server",
  "service unavailable",
  "gateway",
  "rate limit",
  "overloaded",
  "timeout",
  "timed out",
  "invalid",
  "too many requests",
  "permission",
];

function extractLeadingHttpStatus(raw: string): { code: number; rest: string } | null {
  const match = raw.match(HTTP_STATUS_CODE_PREFIX_RE);
  if (!match) {
    return null;
  }
  const code = Number(match[1]);
  if (!Number.isFinite(code)) {
    return null;
  }
  return { code, rest: (match[2] ?? "").trim() };
}

export function isCloudflareOrHtmlErrorPage(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  const status = extractLeadingHttpStatus(trimmed);
  if (!status || status.code < 500) {
    return false;
  }

  if (CLOUDFLARE_HTML_ERROR_CODES.has(status.code)) {
    return true;
  }

  return (
    status.code < 600 && HTML_ERROR_PREFIX_RE.test(status.rest) && /<\/html>/i.test(status.rest)
  );
}

export function isTransientHttpError(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const status = extractLeadingHttpStatus(trimmed);
  if (!status) {
    return false;
  }
  return TRANSIENT_HTTP_ERROR_CODES.has(status.code);
}

function stripFinalTagsFromText(text: string): string {
  if (!text) {
    return text;
  }
  return text.replace(FINAL_TAG_RE, "");
}

/**
 * Strip leading empty lines and leading whitespace from text.
 * Preserves internal structure and trailing content.
 */
function stripLeadingWhitespace(text: string): string {
  if (!text) {
    return text;
  }
  return text.replace(/^[\s]+/, "");
}

function collapseConsecutiveDuplicateBlocks(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return text;
  }
  const blocks = trimmed.split(/\n{2,}/);
  if (blocks.length < 2) {
    return text;
  }

  const normalizeBlock = (value: string) => value.trim().replace(/\s+/g, " ");
  const result: string[] = [];
  let lastNormalized: string | null = null;

  for (const block of blocks) {
    const normalized = normalizeBlock(block);
    if (lastNormalized && normalized === lastNormalized) {
      continue;
    }
    result.push(block.trim());
    lastNormalized = normalized;
  }

  if (result.length === blocks.length) {
    return text;
  }
  return result.join("\n\n");
}

function isLikelyHttpErrorText(raw: string): boolean {
  if (isCloudflareOrHtmlErrorPage(raw)) {
    return true;
  }
  const match = raw.match(HTTP_STATUS_PREFIX_RE);
  if (!match) {
    return false;
  }
  const code = Number(match[1]);
  if (!Number.isFinite(code) || code < 400) {
    return false;
  }
  const message = match[2].toLowerCase();
  return HTTP_ERROR_HINTS.some((hint) => message.includes(hint));
}

type ErrorPayload = Record<string, unknown>;

function isErrorPayloadObject(payload: unknown): payload is ErrorPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const record = payload as ErrorPayload;
  if (record.type === "error") {
    return true;
  }
  if (typeof record.request_id === "string" || typeof record.requestId === "string") {
    return true;
  }
  if ("error" in record) {
    const err = record.error;
    if (err && typeof err === "object" && !Array.isArray(err)) {
      const errRecord = err as ErrorPayload;
      if (
        typeof errRecord.message === "string" ||
        typeof errRecord.type === "string" ||
        typeof errRecord.code === "string"
      ) {
        return true;
      }
    }
  }
  return false;
}

function parseApiErrorPayload(raw: string): ErrorPayload | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const candidates = [trimmed];
  if (ERROR_PAYLOAD_PREFIX_RE.test(trimmed)) {
    candidates.push(trimmed.replace(ERROR_PAYLOAD_PREFIX_RE, "").trim());
  }
  for (const candidate of candidates) {
    if (!candidate.startsWith("{") || !candidate.endsWith("}")) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isErrorPayloadObject(parsed)) {
        return parsed;
      }
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

function stableStringify(value: unknown): string {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).toSorted();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

export function getApiErrorPayloadFingerprint(raw?: string): string | null {
  if (!raw) {
    return null;
  }
  const payload = parseApiErrorPayload(raw);
  if (!payload) {
    return null;
  }
  return stableStringify(payload);
}

export function isRawApiErrorPayload(raw?: string): boolean {
  return getApiErrorPayloadFingerprint(raw) !== null;
}

export type ApiErrorInfo = {
  httpCode?: string;
  type?: string;
  message?: string;
  requestId?: string;
};

export function parseApiErrorInfo(raw?: string): ApiErrorInfo | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let httpCode: string | undefined;
  let candidate = trimmed;

  const httpPrefixMatch = candidate.match(/^(\d{3})\s+(.+)$/s);
  if (httpPrefixMatch) {
    httpCode = httpPrefixMatch[1];
    candidate = httpPrefixMatch[2].trim();
  }

  const payload = parseApiErrorPayload(candidate);
  if (!payload) {
    return null;
  }

  const requestId =
    typeof payload.request_id === "string"
      ? payload.request_id
      : typeof payload.requestId === "string"
        ? payload.requestId
        : undefined;

  const topType = typeof payload.type === "string" ? payload.type : undefined;
  const topMessage = typeof payload.message === "string" ? payload.message : undefined;

  let errType: string | undefined;
  let errMessage: string | undefined;
  if (payload.error && typeof payload.error === "object" && !Array.isArray(payload.error)) {
    const err = payload.error as Record<string, unknown>;
    if (typeof err.type === "string") {
      errType = err.type;
    }
    if (typeof err.code === "string" && !errType) {
      errType = err.code;
    }
    if (typeof err.message === "string") {
      errMessage = err.message;
    }
  }

  return {
    httpCode,
    type: errType ?? topType,
    message: errMessage ?? topMessage,
    requestId,
  };
}

export function formatRawAssistantErrorForUi(raw?: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return "LLM request failed with an unknown error.";
  }

  const leadingStatus = extractLeadingHttpStatus(trimmed);
  if (leadingStatus && isCloudflareOrHtmlErrorPage(trimmed)) {
    return `The AI service is temporarily unavailable (HTTP ${leadingStatus.code}). Please try again in a moment.`;
  }

  const httpMatch = trimmed.match(HTTP_STATUS_PREFIX_RE);
  if (httpMatch) {
    const rest = httpMatch[2].trim();
    if (!rest.startsWith("{")) {
      return `HTTP ${httpMatch[1]}: ${rest}`;
    }
  }

  const info = parseApiErrorInfo(trimmed);
  if (info?.message) {
    const prefix = info.httpCode ? `HTTP ${info.httpCode}` : "LLM error";
    const type = info.type ? ` ${info.type}` : "";
    const requestId = info.requestId ? ` (request_id: ${info.requestId})` : "";
    return `${prefix}${type}: ${info.message}${requestId}`;
  }

  return trimmed.length > 600 ? `${trimmed.slice(0, 600)}…` : trimmed;
}

export function formatAssistantErrorText(
  msg: AssistantMessage,
  opts?: { cfg?: crocbotConfig; sessionKey?: string },
): string | undefined {
  // Also format errors if errorMessage is present, even if stopReason isn't "error"
  const raw = (msg.errorMessage ?? "").trim();
  if (msg.stopReason !== "error" && !raw) {
    return undefined;
  }
  if (!raw) {
    return "LLM request failed with an unknown error.";
  }

  const unknownTool =
    raw.match(/unknown tool[:\s]+["']?([a-z0-9_-]+)["']?/i) ??
    raw.match(/tool\s+["']?([a-z0-9_-]+)["']?\s+(?:not found|is not available)/i);
  if (unknownTool?.[1]) {
    const rewritten = formatSandboxToolPolicyBlockedMessage({
      cfg: opts?.cfg,
      sessionKey: opts?.sessionKey,
      toolName: unknownTool[1],
    });
    if (rewritten) {
      return rewritten;
    }
  }

  if (isContextOverflowError(raw)) {
    return (
      "Context overflow: prompt too large for the model. " +
      "Try /reset (or /new) to start a fresh session, or use a larger-context model."
    );
  }

  // Catch role ordering errors - including JSON-wrapped and "400" prefix variants
  if (
    /incorrect role information|roles must alternate|400.*role|"message".*role.*information/i.test(
      raw,
    )
  ) {
    return (
      "Message ordering conflict - please try again. " +
      "If this persists, use /new to start a fresh session."
    );
  }

  const invalidRequest = raw.match(/"type":"invalid_request_error".*?"message":"([^"]+)"/);
  if (invalidRequest?.[1]) {
    return `LLM request rejected: ${invalidRequest[1]}`;
  }

  if (isOverloadedErrorMessage(raw)) {
    return "The AI service is temporarily overloaded. Please try again in a moment.";
  }

  if (isLikelyHttpErrorText(raw) || isRawApiErrorPayload(raw)) {
    return formatRawAssistantErrorForUi(raw);
  }

  // Never return raw unhandled errors - log for debugging but return safe message
  if (raw.length > 600) {
    console.warn("[formatAssistantErrorText] Long error truncated:", raw.slice(0, 200));
  }
  return raw.length > 600 ? `${raw.slice(0, 600)}…` : raw;
}

export function sanitizeUserFacingText(text: string): string {
  if (!text) {
    return text;
  }
  const stripped = stripFinalTagsFromText(text);
  const trimmed = stripped.trim();
  if (!trimmed) {
    return stripped;
  }

  if (/incorrect role information|roles must alternate/i.test(trimmed)) {
    return (
      "Message ordering conflict - please try again. " +
      "If this persists, use /new to start a fresh session."
    );
  }

  if (isContextOverflowError(trimmed)) {
    return (
      "Context overflow: prompt too large for the model. " +
      "Try /reset (or /new) to start a fresh session, or use a larger-context model."
    );
  }

  if (isRawApiErrorPayload(trimmed) || isLikelyHttpErrorText(trimmed)) {
    return formatRawAssistantErrorForUi(trimmed);
  }

  if (ERROR_PREFIX_RE.test(trimmed)) {
    if (isOverloadedErrorMessage(trimmed) || isRateLimitErrorMessage(trimmed)) {
      return "The AI service is temporarily overloaded. Please try again in a moment.";
    }
    if (isTimeoutErrorMessage(trimmed)) {
      return "LLM request timed out.";
    }
    return formatRawAssistantErrorForUi(trimmed);
  }

  return stripLeadingWhitespace(collapseConsecutiveDuplicateBlocks(stripped));
}

export function isRateLimitAssistantError(msg: AssistantMessage | undefined): boolean {
  if (!msg || msg.stopReason !== "error") {
    return false;
  }
  return isRateLimitErrorMessage(msg.errorMessage ?? "");
}

type ErrorPattern = RegExp | string;

const ERROR_PATTERNS = {
  rateLimit: [
    /rate[_ ]limit|too many requests|429/,
    "exceeded your current quota",
    "resource has been exhausted",
    "quota exceeded",
    "resource_exhausted",
    "usage limit",
  ],
  overloaded: [/overloaded_error|"type"\s*:\s*"overloaded_error"/i, "overloaded"],
  timeout: ["timeout", "timed out", "deadline exceeded", "context deadline exceeded"],
  billing: [
    /["']?(?:status|code)["']?\s*[:=]\s*402\b|\bhttp\s*402\b|\berror(?:\s+code)?\s*[:=]?\s*402\b|\b(?:got|returned|received)\s+(?:a\s+)?402\b|^\s*402\s+payment/i,
    "payment required",
    "insufficient credits",
    "credit balance",
    "plans & billing",
    "insufficient balance",
  ],
  auth: [
    /invalid[_ ]?api[_ ]?key/,
    "incorrect api key",
    "invalid token",
    "authentication",
    "re-authenticate",
    "oauth token refresh failed",
    "unauthorized",
    "forbidden",
    "access denied",
    "expired",
    "token has expired",
    /\b401\b/,
    /\b403\b/,
    "no credentials found",
    "no api key found",
  ],
  format: [
    "string should match pattern",
    "tool_use.id",
    "tool_use_id",
    "messages.1.content.1.tool_use.id",
    "invalid request format",
  ],
} as const;

const IMAGE_DIMENSION_ERROR_RE =
  /image dimensions exceed max allowed size for many-image requests:\s*(\d+)\s*pixels/i;
const IMAGE_DIMENSION_PATH_RE = /messages\.(\d+)\.content\.(\d+)\.image/i;

function matchesErrorPatterns(raw: string, patterns: readonly ErrorPattern[]): boolean {
  if (!raw) {
    return false;
  }
  const value = raw.toLowerCase();
  return patterns.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern),
  );
}

export function isRateLimitErrorMessage(raw: string): boolean {
  return matchesErrorPatterns(raw, ERROR_PATTERNS.rateLimit);
}

export function isTimeoutErrorMessage(raw: string): boolean {
  return matchesErrorPatterns(raw, ERROR_PATTERNS.timeout);
}

export function isBillingErrorMessage(raw: string): boolean {
  const value = raw.toLowerCase();
  if (!value) {
    return false;
  }

  return matchesErrorPatterns(value, ERROR_PATTERNS.billing);
}

export function isBillingAssistantError(msg: AssistantMessage | undefined): boolean {
  if (!msg || msg.stopReason !== "error") {
    return false;
  }
  return isBillingErrorMessage(msg.errorMessage ?? "");
}

export function isAuthErrorMessage(raw: string): boolean {
  return matchesErrorPatterns(raw, ERROR_PATTERNS.auth);
}

export function isOverloadedErrorMessage(raw: string): boolean {
  return matchesErrorPatterns(raw, ERROR_PATTERNS.overloaded);
}

export function parseImageDimensionError(raw: string): {
  maxDimensionPx?: number;
  messageIndex?: number;
  contentIndex?: number;
  raw: string;
} | null {
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();
  if (!lower.includes("image dimensions exceed max allowed size")) {
    return null;
  }
  const limitMatch = raw.match(IMAGE_DIMENSION_ERROR_RE);
  const pathMatch = raw.match(IMAGE_DIMENSION_PATH_RE);
  return {
    maxDimensionPx: limitMatch?.[1] ? Number.parseInt(limitMatch[1], 10) : undefined,
    messageIndex: pathMatch?.[1] ? Number.parseInt(pathMatch[1], 10) : undefined,
    contentIndex: pathMatch?.[2] ? Number.parseInt(pathMatch[2], 10) : undefined,
    raw,
  };
}

export function isImageDimensionErrorMessage(raw: string): boolean {
  return Boolean(parseImageDimensionError(raw));
}

export function isCloudCodeAssistFormatError(raw: string): boolean {
  return !isImageDimensionErrorMessage(raw) && matchesErrorPatterns(raw, ERROR_PATTERNS.format);
}

export function isAuthAssistantError(msg: AssistantMessage | undefined): boolean {
  if (!msg || msg.stopReason !== "error") {
    return false;
  }
  return isAuthErrorMessage(msg.errorMessage ?? "");
}

export function classifyFailoverReason(raw: string): FailoverReason | null {
  if (isImageDimensionErrorMessage(raw)) {
    return null;
  }
  if (isTransientHttpError(raw)) {
    // Treat transient 5xx provider failures as retryable transport issues.
    return "timeout";
  }
  if (isRateLimitErrorMessage(raw)) {
    return "rate_limit";
  }
  if (isOverloadedErrorMessage(raw)) {
    return "rate_limit";
  }
  if (isCloudCodeAssistFormatError(raw)) {
    return "format";
  }
  if (isBillingErrorMessage(raw)) {
    return "billing";
  }
  if (isTimeoutErrorMessage(raw)) {
    return "timeout";
  }
  if (isAuthErrorMessage(raw)) {
    return "auth";
  }
  return null;
}

export function isFailoverErrorMessage(raw: string): boolean {
  return classifyFailoverReason(raw) !== null;
}

export function isFailoverAssistantError(msg: AssistantMessage | undefined): boolean {
  if (!msg || msg.stopReason !== "error") {
    return false;
  }
  return isFailoverErrorMessage(msg.errorMessage ?? "");
}

const RECOVERABLE_TOOL_ERROR_HINTS = [
  "required",
  "missing",
  "invalid",
  "must be",
  "must have",
  "needs",
  "requires",
] as const;

/**
 * Returns true if a tool error message indicates a recoverable/internal error
 * that the model should retry (validation, missing params, etc.).
 * These should not be surfaced to users when a user-facing reply exists.
 */
export function isRecoverableToolError(errorMessage?: string): boolean {
  if (!errorMessage) {
    return false;
  }
  const lower = errorMessage.toLowerCase();
  return RECOVERABLE_TOOL_ERROR_HINTS.some((hint) => lower.includes(hint));
}
