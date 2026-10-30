import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { AgentMessage, StreamFn } from "@earendil-works/pi-agent-core";

import type { crocbotConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import { constrainOutputPath } from "../infra/path-output.js";
import { parseBooleanValue } from "../utils/boolean.js";
import { resolveUserPath } from "../utils.js";

export type CacheTraceStage =
  | "session:loaded"
  | "session:sanitized"
  | "session:limited"
  | "prompt:before"
  | "prompt:images"
  | "stream:context"
  | "session:after";

export type CacheTraceEvent = {
  ts: string;
  seq: number;
  stage: CacheTraceStage;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  modelId?: string;
  modelApi?: string | null;
  workspaceDir?: string;
  prompt?: string;
  system?: unknown;
  options?: Record<string, unknown>;
  model?: Record<string, unknown>;
  messages?: AgentMessage[];
  messageCount?: number;
  messageRoles?: Array<string | undefined>;
  messageFingerprints?: string[];
  messagesDigest?: string;
  systemDigest?: string;
  note?: string;
  error?: string;
};

export type CacheTrace = {
  enabled: true;
  filePath: string;
  recordStage: (stage: CacheTraceStage, payload?: Partial<CacheTraceEvent>) => void;
  wrapStreamFn: (streamFn: StreamFn) => StreamFn;
};

type CacheTraceInit = {
  cfg?: crocbotConfig;
  env?: NodeJS.ProcessEnv;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  modelId?: string;
  modelApi?: string | null;
  workspaceDir?: string;
  writer?: CacheTraceWriter;
};

type CacheTraceConfig = {
  enabled: boolean;
  filePath: string;
  includeMessages: boolean;
  includePrompt: boolean;
  includeSystem: boolean;
};

type CacheTraceWriter = {
  filePath: string;
  write: (line: string) => void;
};

const writers = new Map<string, CacheTraceWriter>();

function resolveCacheTraceConfig(params: CacheTraceInit): CacheTraceConfig {
  const env = params.env ?? process.env;
  const config = params.cfg?.diagnostics?.cacheTrace;
  const envEnabled = parseBooleanValue(env.CROCBOT_CACHE_TRACE);
  const enabled = envEnabled ?? config?.enabled ?? false;
  const stateDir = resolveStateDir(env);
  const logsDir = path.join(stateDir, "logs");
  const fileOverride = config?.filePath?.trim() || env.CROCBOT_CACHE_TRACE_FILE?.trim();
  const filePath = fileOverride
    ? constrainOutputPath({ filePath: resolveUserPath(fileOverride), allowedDir: logsDir })
    : path.join(logsDir, "cache-trace.jsonl");

  const includeMessages =
    parseBooleanValue(env.CROCBOT_CACHE_TRACE_MESSAGES) ?? config?.includeMessages;
  const includePrompt = parseBooleanValue(env.CROCBOT_CACHE_TRACE_PROMPT) ?? config?.includePrompt;
  const includeSystem = parseBooleanValue(env.CROCBOT_CACHE_TRACE_SYSTEM) ?? config?.includeSystem;

  return {
    enabled,
    filePath,
    includeMessages: includeMessages ?? true,
    includePrompt: includePrompt ?? true,
    includeSystem: includeSystem ?? true,
  };
}

function getWriter(filePath: string): CacheTraceWriter {
  const existing = writers.get(filePath);
  if (existing) {
    return existing;
  }

  const dir = path.dirname(filePath);
  const ready = fs.mkdir(dir, { recursive: true }).catch(() => undefined);
  let queue = Promise.resolve();

  const writer: CacheTraceWriter = {
    filePath,
    write: (line: string) => {
      queue = queue
        .then(() => ready)
        .then(() => fs.appendFile(filePath, line, "utf8"))
        .catch(() => undefined);
    },
  };

  writers.set(filePath, writer);
  return writer;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return JSON.stringify(String(value));
  }
  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }
  if (typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (value instanceof Error) {
    return stableStringify({
      name: value.name,
      message: value.message,
      stack: value.stack,
    });
  }
  if (value instanceof Uint8Array) {
    return stableStringify({
      type: "Uint8Array",
      data: Buffer.from(value).toString("base64"),
    });
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).toSorted();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

function digest(value: unknown): string {
  const serialized = stableStringify(value);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function summarizeMessages(messages: AgentMessage[]): {
  messageCount: number;
  messageRoles: Array<string | undefined>;
  messageFingerprints: string[];
  messagesDigest: string;
} {
  const messageFingerprints = messages.map((msg) => digest(msg));
  return {
    messageCount: messages.length,
    messageRoles: messages.map((msg) => (msg as { role?: string }).role),
    messageFingerprints,
    messagesDigest: digest(messageFingerprints.join("|")),
  };
}

function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") {
        return val.toString();
      }
      if (typeof val === "function") {
        return "[Function]";
      }
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      if (val instanceof Uint8Array) {
        return { type: "Uint8Array", data: Buffer.from(val).toString("base64") };
      }
      return val;
    });
  } catch {
    return null;
  }
}

const REDACTED = "[REDACTED]";

// Header-name redaction prefers safety over readability (trace-only, the wrapped
// stream fn still receives the real options). Any of these substrings in the
// lowercased name redacts the value, so compounds such as `X-Apitoken`,
// `X-Secretkey`, `X-Passphrase` or `X-Authz` are caught. Known over-redaction:
// `X-Session-Id`, `X-Signature-Version`, `X-Keyboard`, `X-Author`, `Monkey`, ...
const SENSITIVE_NAME_SUBSTRING_RE =
  /auth|token|secret|pass|key|jwt|hmac|sig|cookie|session|credential|bearer|private/;
// Short markers only matched as whole words (`pat` must not hit `path`).
const SENSITIVE_NAME_WORDS = new Set(["pat", "otp", "pwd", "pin"]);
// Token count/limit headers (`X-Max-Tokens: 100`, `anthropic-ratelimit-input-tokens-
// remaining: 1000`) are the only exemption. Every word of the name must be on this
// allowlist (so a camelCase straddle such as `maxTokenSecret` or `X-MaxTokensIg` can
// never slip through), with at least one `token(s)` word and one count word, and the
// value must be a small integer. `reset`/`used` are deliberately not count words:
// `X-Reset-Token: 482913` is a credential shape.
const TOKEN_WORDS = new Set(["token", "tokens"]);
const TOKEN_COUNT_WORDS = new Set(["max", "count", "remaining", "limit"]);
const TOKEN_COUNT_NEUTRAL_WORDS = new Set([
  "x",
  "ratelimit",
  "rate",
  "anthropic",
  "openai",
  "input",
  "output",
  "prompt",
  "completion",
  "total",
]);
const SMALL_INT_RE = /^\s*\d{1,9}\s*$/;

function headerNameWords(lowerName: string): string[] {
  return lowerName.split(/[^a-z0-9]+/).filter(Boolean);
}

function camelWords(name: string): string[] {
  return headerNameWords(name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase());
}

/** True when the name alone marks the header as credential-bearing. */
export function isSensitiveHeaderName(name: string): boolean {
  const lower = name.toLowerCase();
  if (SENSITIVE_NAME_SUBSTRING_RE.test(lower)) {
    return true;
  }
  return camelWords(name).some((word) => SENSITIVE_NAME_WORDS.has(word));
}

function isTokenCountHeader(name: string, value: unknown): boolean {
  if (typeof value !== "string" || !SMALL_INT_RE.test(value)) {
    return false;
  }
  const words = camelWords(name);
  let hasToken = false;
  let hasCount = false;
  for (const word of words) {
    if (TOKEN_WORDS.has(word)) {
      hasToken = true;
      continue;
    }
    // token/tokens must be the only sensitive word (checked per word, never by
    // stripping substrings out of the joined name).
    if (SENSITIVE_NAME_SUBSTRING_RE.test(word) || SENSITIVE_NAME_WORDS.has(word)) {
      return false;
    }
    if (TOKEN_COUNT_WORDS.has(word)) {
      hasCount = true;
    } else if (!TOKEN_COUNT_NEUTRAL_WORDS.has(word)) {
      return false;
    }
  }
  return hasToken && hasCount;
}

// Every regex below is linear: no nested or adjacent overlapping quantifiers, and
// each scan is anchored at `^` or a non-alphanumeric boundary (see the ReDoS test).
// Any non-empty Bearer credential, anywhere in the value (comma lists included).
const BEARER_RE = /(?:^|[^a-z0-9])bearer\s+\S/i;
// `token=...` param forms: Rails `Token token="..."`, bare `token="..."`, `access_token=`.
const TOKEN_PARAM_RE = /(?:^|[^a-z0-9])token\s*=/i;
// `<scheme> name=value, ...` auth-param schemes (RFC 7616 Digest, AWS SigV4, HOBA).
const PARAM_SCHEME_RE = /^\s*(?:digest|aws4-hmac-sha256|hoba)\s+[a-z0-9_-]+\s*=/i;
// `<scheme> <token68>` with a credential-shaped token (no spaces, >= 8 chars).
const TOKEN68_SCHEME_RE =
  /^\s*(?:token|negotiate|ntlm|hoba|apikey|ssws)\s+[A-Za-z0-9\-._~+/]{8,}=*\s*$/i;
// `Key <token>` only with a 16+ char credential-shaped token, so prose such as
// `Key performance` / `Key Takeaways` stays readable.
const KEY_SCHEME_RE = /^\s*key\s+[A-Za-z0-9\-._~+/]{16,}=*\s*$/i;
// A Basic scheme followed directly by a separator (`Basic ;user:pw`, `Basic , b64`)
// is malformed but still carries a credential: fail closed on the whole value.
const BASIC_SEPARATOR_RE = /^\s*basic\s*[,;]/i;
// Basic: decided on the first token after the scheme (see isBasicCredential).
const BASIC_FIRST_TOKEN_RE = /^\s*basic\s+([^\s,;]+)/i;
// Scheme-less provider keys and JWT-shaped values under neutral names.
const SK_KEY_RE = /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{8}/;
const JWT_RE = /(?:^|[^A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\./;
// Well-known vendor key shapes: Stripe (restricted keys are `rk_live_`/`rk_test_` + 10-99
// alphanumerics per Stripe docs and GitHub push protection), GitHub, Slack, AWS access key ids, Google API keys.
const VENDOR_KEY_RE =
  /(?:^|[^A-Za-z0-9])(?:(?:sk_live_|sk_test_|ghp_|gho_|ghs_|ghu_|ghr_|github_pat_|xoxb-|xoxp-)[A-Za-z0-9_-]{8}|rk_(?:live|test)_[A-Za-z0-9]{10}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})/;

// `Basic <x>`: redact when the first token contains ':' (raw user:pass), is 8+
// chars, or leniently base64-decodes to something containing ':' (`Basic YTpi`).
// Prose such as `Basic plan` stays readable.
function isBasicCredential(segment: string): boolean {
  const first = BASIC_FIRST_TOKEN_RE.exec(segment)?.[1];
  if (!first) {
    return false;
  }
  if (first.includes(":") || first.length >= 8) {
    return true;
  }
  const payload = first
    .replace(/[^A-Za-z0-9+/=\-_]+$/, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Buffer.from(payload, "base64").toString("latin1").includes(":");
}

export function isCredentialHeaderValue(value: string): boolean {
  if (BEARER_RE.test(value) || TOKEN_PARAM_RE.test(value)) {
    return true;
  }
  if (SK_KEY_RE.test(value) || JWT_RE.test(value) || VENDOR_KEY_RE.test(value)) {
    return true;
  }
  if (BASIC_SEPARATOR_RE.test(value)) {
    return true;
  }
  // Check each comma-separated credential (`Token a, Basic b`) on its own.
  return value
    .split(",")
    .some(
      (segment) =>
        PARAM_SCHEME_RE.test(segment) ||
        TOKEN68_SCHEME_RE.test(segment) ||
        KEY_SCHEME_RE.test(segment) ||
        isBasicCredential(segment),
    );
}

function redactHeaderValue(name: string, value: unknown): unknown {
  if (value == null) {
    return value;
  }
  if (isSensitiveHeaderName(name) && !isTokenCountHeader(name, value)) {
    return Array.isArray(value) ? value.map(() => REDACTED) : REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string" && isCredentialHeaderValue(item) ? REDACTED : item,
    );
  }
  return typeof value === "string" && isCredentialHeaderValue(value) ? REDACTED : value;
}

function redactHeaders(headers: unknown): unknown {
  if (!headers || typeof headers !== "object") {
    return headers;
  }
  // Tuple form: [["Authorization", "Bearer ..."], ...]
  if (Array.isArray(headers)) {
    return headers.map((entry) =>
      Array.isArray(entry) && typeof entry[0] === "string"
        ? [entry[0], ...entry.slice(1).map((value) => redactHeaderValue(entry[0], value))]
        : entry,
    );
  }
  // Fetch `Headers`, `Map`, or any object exposing `.entries()`. A `Map` keeps the
  // caller's casing. A fetch `Headers` cannot: the Fetch spec lowercases names on
  // insertion, so the original casing is gone before we see it (and the lowercase
  // form is what undici sends on the wire). We emit those names as-is rather than
  // invent a "canonical" casing that was never sent.
  if (typeof (headers as { entries?: unknown }).entries === "function") {
    const out: Record<string, unknown> = {};
    for (const [name, value] of (headers as Headers).entries()) {
      out[name] = redactHeaderValue(name, value);
    }
    return out;
  }
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    out[name] = redactHeaderValue(name, value);
  }
  return out;
}

/**
 * Strip credentials from stream options before they reach the trace file:
 * `apiKey`, auth-bearing request headers, and provider env values.
 */
export function redactTraceOptions(options: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...options };
  if (out.apiKey != null) {
    out.apiKey = REDACTED;
  }
  if ("headers" in out) {
    out.headers = redactHeaders(out.headers);
  }
  if (out.env && typeof out.env === "object" && !Array.isArray(out.env)) {
    out.env = Object.fromEntries(Object.keys(out.env).map((key) => [key, REDACTED]));
  }
  return out;
}

export function createCacheTrace(params: CacheTraceInit): CacheTrace | null {
  const cfg = resolveCacheTraceConfig(params);
  if (!cfg.enabled) {
    return null;
  }

  const writer = params.writer ?? getWriter(cfg.filePath);
  let seq = 0;

  const base: Omit<CacheTraceEvent, "ts" | "seq" | "stage"> = {
    runId: params.runId,
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    provider: params.provider,
    modelId: params.modelId,
    modelApi: params.modelApi,
    workspaceDir: params.workspaceDir,
  };

  const recordStage: CacheTrace["recordStage"] = (stage, payload = {}) => {
    const event: CacheTraceEvent = {
      ...base,
      ts: new Date().toISOString(),
      seq: (seq += 1),
      stage,
    };

    if (payload.prompt !== undefined && cfg.includePrompt) {
      event.prompt = payload.prompt;
    }
    if (payload.system !== undefined && cfg.includeSystem) {
      event.system = payload.system;
      event.systemDigest = digest(payload.system);
    }
    if (payload.options) {
      event.options = redactTraceOptions(payload.options);
    }
    if (payload.model) {
      event.model = payload.model;
    }

    const messages = payload.messages;
    if (Array.isArray(messages)) {
      const summary = summarizeMessages(messages);
      event.messageCount = summary.messageCount;
      event.messageRoles = summary.messageRoles;
      event.messageFingerprints = summary.messageFingerprints;
      event.messagesDigest = summary.messagesDigest;
      if (cfg.includeMessages) {
        event.messages = messages;
      }
    }

    if (payload.note) {
      event.note = payload.note;
    }
    if (payload.error) {
      event.error = payload.error;
    }

    const line = safeJsonStringify(event);
    if (!line) {
      return;
    }
    writer.write(`${line}\n`);
  };

  const wrapStreamFn: CacheTrace["wrapStreamFn"] = (streamFn) => {
    const wrapped: StreamFn = (model, context, options) => {
      recordStage("stream:context", {
        model: {
          id: model?.id,
          provider: model?.provider,
          api: model?.api,
        },
        system: (context as { system?: unknown }).system,
        messages: (context as { messages?: AgentMessage[] }).messages ?? [],
        options: (options ?? {}) as Record<string, unknown>,
      });
      return streamFn(model, context, options);
    };
    return wrapped;
  };

  return {
    enabled: true,
    filePath: cfg.filePath,
    recordStage,
    wrapStreamFn,
  };
}
