import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { OAuthCredentials, OAuthProvider } from "@mariozechner/pi-ai";

import { loadJsonFile, saveJsonFile } from "../infra/json-file.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveUserPath } from "../utils.js";

const log = createSubsystemLogger("agents/auth-profiles");

const CLAUDE_CLI_CREDENTIALS_RELATIVE_PATH = ".claude/.credentials.json";
const CODEX_CLI_AUTH_FILENAME = "auth.json";
const QWEN_CLI_CREDENTIALS_RELATIVE_PATH = ".qwen/oauth_creds.json";

type CachedValue<T> = {
  value: T | null;
  readAt: number;
  cacheKey: string;
};

let claudeCliCache: CachedValue<ClaudeCliCredential> | null = null;
let codexCliCache: CachedValue<CodexCliCredential> | null = null;
let qwenCliCache: CachedValue<QwenCliCredential> | null = null;

export function resetCliCredentialCachesForTest(): void {
  claudeCliCache = null;
  codexCliCache = null;
  qwenCliCache = null;
}

export type ClaudeCliCredential =
  | {
      type: "oauth";
      provider: "anthropic";
      access: string;
      refresh: string;
      expires: number;
    }
  | {
      type: "token";
      provider: "anthropic";
      token: string;
      expires: number;
    };

export type CodexCliCredential = {
  type: "oauth";
  provider: OAuthProvider;
  access: string;
  refresh: string;
  expires: number;
  accountId?: string;
};

export type QwenCliCredential = {
  type: "oauth";
  provider: "qwen-portal";
  access: string;
  refresh: string;
  expires: number;
};

type ClaudeCliFileOptions = {
  homeDir?: string;
};

type ClaudeCliWriteOptions = ClaudeCliFileOptions & {
  platform?: NodeJS.Platform;
  writeKeychain?: (credentials: OAuthCredentials) => boolean;
  writeFile?: (credentials: OAuthCredentials, options?: ClaudeCliFileOptions) => boolean;
};

type ExecSyncFn = typeof execSync;

function resolveClaudeCliCredentialsPath(homeDir?: string) {
  const baseDir = homeDir ?? resolveUserPath("~");
  return path.join(baseDir, CLAUDE_CLI_CREDENTIALS_RELATIVE_PATH);
}

function resolveCodexCliAuthPath() {
  return path.join(resolveCodexHomePath(), CODEX_CLI_AUTH_FILENAME);
}

function resolveCodexHomePath() {
  const configured = process.env.CODEX_HOME;
  const home = configured ? resolveUserPath(configured) : resolveUserPath("~/.codex");
  try {
    return fs.realpathSync.native(home);
  } catch {
    return home;
  }
}

function resolveQwenCliCredentialsPath(homeDir?: string) {
  const baseDir = homeDir ?? resolveUserPath("~");
  return path.join(baseDir, QWEN_CLI_CREDENTIALS_RELATIVE_PATH);
}

// Keychain-based credential reading is not available on Linux.
function readCodexKeychainCredentials(_options?: {
  platform?: NodeJS.Platform;
  execSync?: ExecSyncFn;
}): CodexCliCredential | null {
  return null;
}

function readQwenCliCredentials(options?: { homeDir?: string }): QwenCliCredential | null {
  const credPath = resolveQwenCliCredentialsPath(options?.homeDir);
  const raw = loadJsonFile(credPath);
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expiresAt = data.expiry_date;

  if (typeof accessToken !== "string" || !accessToken) {
    return null;
  }
  if (typeof refreshToken !== "string" || !refreshToken) {
    return null;
  }
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return null;
  }

  return {
    type: "oauth",
    provider: "qwen-portal",
    access: accessToken,
    refresh: refreshToken,
    expires: expiresAt,
  };
}

export function readClaudeCliCredentials(options?: {
  allowKeychainPrompt?: boolean;
  platform?: NodeJS.Platform;
  homeDir?: string;
  execSync?: ExecSyncFn;
}): ClaudeCliCredential | null {
  const credPath = resolveClaudeCliCredentialsPath(options?.homeDir);
  const raw = loadJsonFile(credPath);
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const claudeOauth = data.claudeAiOauth as Record<string, unknown> | undefined;
  if (!claudeOauth || typeof claudeOauth !== "object") {
    return null;
  }

  const accessToken = claudeOauth.accessToken;
  const refreshToken = claudeOauth.refreshToken;
  const expiresAt = claudeOauth.expiresAt;

  if (typeof accessToken !== "string" || !accessToken) {
    return null;
  }
  if (typeof expiresAt !== "number" || expiresAt <= 0) {
    return null;
  }

  if (typeof refreshToken === "string" && refreshToken) {
    return {
      type: "oauth",
      provider: "anthropic",
      access: accessToken,
      refresh: refreshToken,
      expires: expiresAt,
    };
  }

  return {
    type: "token",
    provider: "anthropic",
    token: accessToken,
    expires: expiresAt,
  };
}

export function readClaudeCliCredentialsCached(options?: {
  allowKeychainPrompt?: boolean;
  ttlMs?: number;
  platform?: NodeJS.Platform;
  homeDir?: string;
  execSync?: ExecSyncFn;
}): ClaudeCliCredential | null {
  const ttlMs = options?.ttlMs ?? 0;
  const now = Date.now();
  const cacheKey = resolveClaudeCliCredentialsPath(options?.homeDir);
  if (
    ttlMs > 0 &&
    claudeCliCache &&
    claudeCliCache.cacheKey === cacheKey &&
    now - claudeCliCache.readAt < ttlMs
  ) {
    return claudeCliCache.value;
  }
  const value = readClaudeCliCredentials({
    allowKeychainPrompt: options?.allowKeychainPrompt,
    platform: options?.platform,
    homeDir: options?.homeDir,
    execSync: options?.execSync,
  });
  if (ttlMs > 0) {
    claudeCliCache = { value, readAt: now, cacheKey };
  }
  return value;
}

// Keychain-based credential writing is not available on Linux.
export function writeClaudeCliKeychainCredentials(
  _newCredentials: OAuthCredentials,
  _options?: { execSync?: ExecSyncFn },
): boolean {
  return false;
}

export function writeClaudeCliFileCredentials(
  newCredentials: OAuthCredentials,
  options?: ClaudeCliFileOptions,
): boolean {
  const credPath = resolveClaudeCliCredentialsPath(options?.homeDir);

  if (!fs.existsSync(credPath)) {
    return false;
  }

  try {
    const raw = loadJsonFile(credPath);
    if (!raw || typeof raw !== "object") {
      return false;
    }

    const data = raw as Record<string, unknown>;
    const existingOauth = data.claudeAiOauth as Record<string, unknown> | undefined;
    if (!existingOauth || typeof existingOauth !== "object") {
      return false;
    }

    data.claudeAiOauth = {
      ...existingOauth,
      accessToken: newCredentials.access,
      refreshToken: newCredentials.refresh,
      expiresAt: newCredentials.expires,
    };

    saveJsonFile(credPath, data);
    log.info("wrote refreshed credentials to claude cli file", {
      expires: new Date(newCredentials.expires).toISOString(),
    });
    return true;
  } catch (error) {
    log.warn("failed to write credentials to claude cli file", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function writeClaudeCliCredentials(
  newCredentials: OAuthCredentials,
  options?: ClaudeCliWriteOptions,
): boolean {
  const writeFile =
    options?.writeFile ??
    ((credentials, fileOptions) => writeClaudeCliFileCredentials(credentials, fileOptions));

  return writeFile(newCredentials, { homeDir: options?.homeDir });
}

export function readCodexCliCredentials(options?: {
  platform?: NodeJS.Platform;
  execSync?: ExecSyncFn;
}): CodexCliCredential | null {
  const keychain = readCodexKeychainCredentials({
    platform: options?.platform,
    execSync: options?.execSync,
  });
  if (keychain) {
    return keychain;
  }

  const authPath = resolveCodexCliAuthPath();
  const raw = loadJsonFile(authPath);
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const tokens = data.tokens as Record<string, unknown> | undefined;
  if (!tokens || typeof tokens !== "object") {
    return null;
  }

  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;

  if (typeof accessToken !== "string" || !accessToken) {
    return null;
  }
  if (typeof refreshToken !== "string" || !refreshToken) {
    return null;
  }

  let expires: number;
  try {
    const stat = fs.statSync(authPath);
    expires = stat.mtimeMs + 60 * 60 * 1000;
  } catch {
    expires = Date.now() + 60 * 60 * 1000;
  }

  return {
    type: "oauth",
    provider: "openai-codex" as OAuthProvider,
    access: accessToken,
    refresh: refreshToken,
    expires,
    accountId: typeof tokens.account_id === "string" ? tokens.account_id : undefined,
  };
}

export function readCodexCliCredentialsCached(options?: {
  ttlMs?: number;
  platform?: NodeJS.Platform;
  execSync?: ExecSyncFn;
}): CodexCliCredential | null {
  const ttlMs = options?.ttlMs ?? 0;
  const now = Date.now();
  const cacheKey = `${options?.platform ?? process.platform}|${resolveCodexCliAuthPath()}`;
  if (
    ttlMs > 0 &&
    codexCliCache &&
    codexCliCache.cacheKey === cacheKey &&
    now - codexCliCache.readAt < ttlMs
  ) {
    return codexCliCache.value;
  }
  const value = readCodexCliCredentials({
    platform: options?.platform,
    execSync: options?.execSync,
  });
  if (ttlMs > 0) {
    codexCliCache = { value, readAt: now, cacheKey };
  }
  return value;
}

export function readQwenCliCredentialsCached(options?: {
  ttlMs?: number;
  homeDir?: string;
}): QwenCliCredential | null {
  const ttlMs = options?.ttlMs ?? 0;
  const now = Date.now();
  const cacheKey = resolveQwenCliCredentialsPath(options?.homeDir);
  if (
    ttlMs > 0 &&
    qwenCliCache &&
    qwenCliCache.cacheKey === cacheKey &&
    now - qwenCliCache.readAt < ttlMs
  ) {
    return qwenCliCache.value;
  }
  const value = readQwenCliCredentials({ homeDir: options?.homeDir });
  if (ttlMs > 0) {
    qwenCliCache = { value, readAt: now, cacheKey };
  }
  return value;
}
