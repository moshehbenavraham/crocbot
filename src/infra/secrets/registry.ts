/**
 * Centralized secrets registry for value-based masking.
 *
 * Auto-discovers secret values from process.env and config objects at
 * initialization, then provides mask(text) and unmask(text) operations.
 * Complements the existing key-name-based redaction in src/config/redact.ts
 * and regex-based text redaction in src/logging/redact.ts.
 */

import { getSensitiveExactKeys, getSensitiveKeyPatterns } from "../../config/redact.js";
import { createMasker } from "./masker.js";
import type { SecretsMasker } from "./masker.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A registered secret entry. */
export interface SecretEntry {
  /** Human-readable name / source key for this secret. */
  name: string;
  /** The actual secret value. */
  value: string;
}

/** Options for registry initialization. */
export interface RegistryOptions {
  /** Minimum secret length to register (default: 8). */
  minLength?: number;
  /** Skip auto-discovery from process.env (default: false). */
  skipEnv?: boolean;
}

// ---------------------------------------------------------------------------
// Env var key matching
// ---------------------------------------------------------------------------

/** Suffixes in env var names that indicate secret values. */
const ENV_SECRET_SUFFIXES = [
  "_KEY",
  "_TOKEN",
  "_SECRET",
  "_PASSWORD",
  "_PASSWD",
  "_CREDENTIAL",
  "_API_KEY",
  "_APIKEY",
];

/** Well-known env var prefixes/names to skip (non-sensitive system vars). */
const ENV_SKIP_NAMES = new Set([
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "TERM",
  "LANG",
  "EDITOR",
  "NODE_ENV",
  "NODE_PATH",
  "NODE_OPTIONS",
  "PWD",
  "OLDPWD",
  "HOSTNAME",
  "LOGNAME",
  "DISPLAY",
  "XDG_SESSION_TYPE",
  "XDG_RUNTIME_DIR",
  "XDG_DATA_DIRS",
  "XDG_CONFIG_DIRS",
  "DBUS_SESSION_BUS_ADDRESS",
  "SSH_AUTH_SOCK",
  "COLORTERM",
  "LS_COLORS",
  "LESSOPEN",
  "LESSCLOSE",
  "_",
  "SHLVL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "CI",
  "GITHUB_ACTIONS",
  "PNPM_HOME",
  "npm_config_registry",
  "npm_config_user_agent",
  "WSLENV",
  "WSL_DISTRO_NAME",
  "WSL_INTEROP",
  "WT_SESSION",
  "WT_PROFILE_ID",
]);

/** Common API key / token prefixes that indicate a value is a secret. */
const SECRET_VALUE_PREFIXES = [
  "sk-", // OpenAI
  "ghp_", // GitHub PAT
  "github_pat_", // GitHub PAT new
  "xox", // Slack (xoxb-, xoxp-, etc.)
  "xapp-", // Slack app
  "gsk_", // Groq
  "AIza", // Google
  "pplx-", // Perplexity
  "npm_", // npm
];

/**
 * Check if an env var key name looks like it holds a secret.
 * Uses suffix matching and reuses patterns from src/config/redact.ts.
 */
function isSecretEnvKey(key: string): boolean {
  if (ENV_SKIP_NAMES.has(key)) {
    return false;
  }

  const upper = key.toUpperCase();
  for (const suffix of ENV_SECRET_SUFFIXES) {
    if (upper.endsWith(suffix)) {
      return true;
    }
  }

  // Check against the config redaction patterns (reused from src/config/redact.ts)
  const patterns = getSensitiveKeyPatterns();
  for (const source of patterns) {
    const re = new RegExp(source, "i");
    if (re.test(key)) {
      return true;
    }
  }

  const exactKeys = getSensitiveExactKeys();
  for (const exact of exactKeys) {
    if (key === exact || key.toLowerCase() === exact.toLowerCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a value looks like a secret based on known prefixes.
 * Mirrors the looksLikeSecret heuristic from src/config/redact.ts.
 */
function looksLikeSecretValue(value: string): boolean {
  if (value.length < 8) {
    return false;
  }

  for (const prefix of SECRET_VALUE_PREFIXES) {
    if (value.startsWith(prefix)) {
      return true;
    }
  }

  // Telegram bot token pattern: digits:alphanumeric
  if (/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value)) {
    return true;
  }

  // PEM private key
  if (value.startsWith("-----BEGIN ") && value.includes("PRIVATE KEY")) {
    return true;
  }

  return false;
}

/**
 * Check if a config key is sensitive, using the same patterns as
 * src/config/redact.ts.
 */
function isSensitiveConfigKey(key: string): boolean {
  const exactKeys = getSensitiveExactKeys();
  for (const exact of exactKeys) {
    if (key === exact) {
      return true;
    }
  }

  const patterns = getSensitiveKeyPatterns();
  for (const source of patterns) {
    const re = new RegExp(source, "i");
    if (re.test(key)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// SecretsRegistry
// ---------------------------------------------------------------------------

const DEFAULT_MIN_LENGTH = 8;

export class SecretsRegistry {
  private static instance: SecretsRegistry | undefined;

  private readonly secrets = new Map<string, string>();
  private readonly minLength: number;
  private masker: SecretsMasker | undefined;
  private isDirty = true;

  private constructor(options?: RegistryOptions) {
    this.minLength = options?.minLength ?? DEFAULT_MIN_LENGTH;
  }

  /** Get the process-wide singleton instance. */
  static getInstance(options?: RegistryOptions): SecretsRegistry {
    if (!SecretsRegistry.instance) {
      SecretsRegistry.instance = new SecretsRegistry(options);
    }
    return SecretsRegistry.instance;
  }

  /** Reset the singleton (for testing). */
  static reset(): void {
    SecretsRegistry.instance = undefined;
  }

  /**
   * Initialize the registry by auto-discovering secrets from process.env
   * and an optional config object.
   */
  init(config?: Record<string, unknown>, options?: RegistryOptions): void {
    const skipEnv = options?.skipEnv ?? false;

    if (!skipEnv) {
      this.discoverFromEnv(process.env as Record<string, string | undefined>);
    }

    if (config) {
      this.discoverFromConfig(config);
    }

    // Force recompile after init
    this.isDirty = true;
  }

  /**
   * Register a secret explicitly.
   * Returns true if the secret was registered, false if skipped (too short).
   */
  register(name: string, value: string): boolean {
    if (!value || value.length < this.minLength) {
      return false;
    }
    this.secrets.set(name, value);
    this.isDirty = true;
    return true;
  }

  /** Unregister a secret by name. */
  unregister(name: string): boolean {
    const existed = this.secrets.delete(name);
    if (existed) {
      this.isDirty = true;
    }
    return existed;
  }

  /** Replace all registered secret values with {{SECRET:hash8}} placeholders. */
  mask(text: string): string {
    this.ensureCompiled();
    return this.masker!.mask(text);
  }

  /** Restore {{SECRET:hash8}} placeholders to original secret values. */
  unmask(text: string): string {
    this.ensureCompiled();
    return this.masker!.unmask(text);
  }

  /** Number of registered secrets (not counting encoding variants). */
  get size(): number {
    return this.secrets.size;
  }

  /** Number of individual match patterns (including encoding variants). */
  get patternCount(): number {
    this.ensureCompiled();
    return this.masker!.patternCount;
  }

  /** Check whether a specific secret name is registered. */
  has(name: string): boolean {
    return this.secrets.has(name);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /** Lazily recompile the masker when secrets have changed. */
  private ensureCompiled(): void {
    if (this.isDirty || !this.masker) {
      this.masker = createMasker(this.secrets);
      this.isDirty = false;
    }
  }

  /** Scan process.env for secret-looking entries. */
  private discoverFromEnv(env: Record<string, string | undefined>): void {
    for (const [key, value] of Object.entries(env)) {
      if (!value || value.length < this.minLength) {
        continue;
      }

      if (isSecretEnvKey(key) || looksLikeSecretValue(value)) {
        this.secrets.set(`env:${key}`, value);
      }
    }
  }

  /** Recursively scan a config object for sensitive values. */
  private discoverFromConfig(obj: Record<string, unknown>, prefix = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "string") {
        if (
          value.length >= this.minLength &&
          (isSensitiveConfigKey(key) || looksLikeSecretValue(value))
        ) {
          this.secrets.set(`config:${path}`, value);
        }
      } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        this.discoverFromConfig(value as Record<string, unknown>, path);
      }
    }
  }
}
