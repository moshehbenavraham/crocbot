/**
 * Synchronous security audit collector functions.
 *
 * These functions analyze config-based security properties without I/O.
 */
import type { SandboxToolPolicy } from "../agents/sandbox/types.js";
import type { crocbotConfig } from "../config/config.js";

import { isToolAllowedByPolicies } from "../agents/pi-tools.policy.js";
import {
  resolveSandboxConfigForAgent,
  resolveSandboxToolPolicyForAgent,
} from "../agents/sandbox.js";
import { resolveToolProfilePolicy } from "../agents/tool-policy.js";
import { resolveBrowserConfig } from "../browser/config.js";

import { resolveGatewayAuth } from "../gateway/auth.js";

export type SecurityAuditFinding = {
  checkId: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  remediation?: string;
};

const SMALL_MODEL_PARAM_B_MAX = 300;

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function summarizeGroupPolicy(cfg: crocbotConfig): {
  open: number;
  allowlist: number;
  other: number;
} {
  const channels = cfg.channels as Record<string, unknown> | undefined;
  if (!channels || typeof channels !== "object") {
    return { open: 0, allowlist: 0, other: 0 };
  }
  let open = 0;
  let allowlist = 0;
  let other = 0;
  for (const value of Object.values(channels)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const section = value as Record<string, unknown>;
    const policy = section.groupPolicy;
    if (policy === "open") {
      open += 1;
    } else if (policy === "allowlist") {
      allowlist += 1;
    } else {
      other += 1;
    }
  }
  return { open, allowlist, other };
}

function isProbablySyncedPath(p: string): boolean {
  const s = p.toLowerCase();
  return (
    s.includes("icloud") ||
    s.includes("dropbox") ||
    s.includes("google drive") ||
    s.includes("googledrive") ||
    s.includes("onedrive")
  );
}

function looksLikeEnvRef(value: string): boolean {
  return /^\$\{?\w+\}?$/.test(value.trim());
}

type ModelRef = { id: string; source: string };

function addModel(models: ModelRef[], raw: unknown, source: string) {
  if (typeof raw === "string" && raw.trim()) {
    models.push({ id: raw.trim().toLowerCase(), source });
  } else if (raw && typeof raw === "object" && "model" in raw) {
    const m = (raw as Record<string, unknown>).model;
    if (typeof m === "string" && m.trim()) {
      models.push({ id: m.trim().toLowerCase(), source });
    }
  }
}

function collectModels(cfg: crocbotConfig): ModelRef[] {
  const models: ModelRef[] = [];
  addModel(models, cfg.agents?.defaults?.model, "agents.defaults.model");
  if (Array.isArray(cfg.agents?.list)) {
    for (const agent of cfg.agents.list) {
      if (!agent || typeof agent !== "object") {
        continue;
      }
      const id =
        typeof agent.id === "string" ? agent.id : typeof agent.name === "string" ? agent.name : "?";
      addModel(models, agent.model, `agents.list[${id}].model`);
      const agentModel = agent.model;
      if (agentModel && typeof agentModel === "object" && Array.isArray(agentModel.fallbacks)) {
        for (const altModel of agentModel.fallbacks) {
          addModel(models, altModel, `agents.list[${id}].model.fallbacks[]`);
        }
      }
    }
  }
  return models;
}

const LEGACY_MODEL_PATTERNS: Array<{ id: string; re: RegExp; label: string }> = [
  { id: "gpt-3.5", re: /gpt-?3\.?5/i, label: "GPT-3.5" },
  { id: "gpt-4-0613", re: /gpt-4-0613/i, label: "GPT-4 (0613 — early, deprecated)" },
  { id: "claude-2", re: /claude-2/i, label: "Claude 2" },
  { id: "palm", re: /^palm/i, label: "PaLM" },
];

const WEAK_TIER_MODEL_PATTERNS: Array<{ id: string; re: RegExp; label: string }> = [
  { id: "gpt-4-mini", re: /gpt-?4o?-?mini/i, label: "GPT-4o Mini (small, high speed)" },
  { id: "claude-haiku", re: /claude.*haiku/i, label: "Claude Haiku (small, high speed)" },
];

function inferParamBFromIdOrName(text: string): number | null {
  const match = /(\d+(?:\.\d+)?)[\s]*[bB]\b/.exec(text);
  if (match) {
    const value = Number.parseFloat(match[1]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  const match2 = /(\d+(?:\.\d+)?)[\s]*[mM]\b/.exec(text);
  if (match2) {
    const value = Number.parseFloat(match2[1]);
    if (Number.isFinite(value) && value > 0) {
      return value / 1000;
    }
  }
  const matchPlain = /\b(\d{1,3})(?:$|[\s_-])/.exec(text);
  if (matchPlain) {
    const value = Number.parseInt(matchPlain[1], 10);
    if (Number.isFinite(value) && value > 0 && value <= 500) {
      return value;
    }
  }
  return null;
}

function isGptModel(id: string): boolean {
  return /gpt/i.test(id);
}

function isGpt5OrHigher(id: string): boolean {
  return /gpt-?([5-9]|[1-9]\d)/i.test(id);
}

function isClaudeModel(id: string): boolean {
  return /claude/i.test(id);
}

function isClaude45OrHigher(id: string): boolean {
  return /claude.*([4-9]\.[5-9]|[5-9]\.|[1-9]\d\.)/i.test(id);
}

function extractAgentIdFromSource(source: string): string | null {
  const m = /agents\.list\[(\w+)\]/.exec(source);
  return m ? m[1] : null;
}

function pickToolPolicy(config?: { allow?: string[]; deny?: string[] }): SandboxToolPolicy | null {
  if (!config) {
    return null;
  }
  const allow = config.allow;
  const deny = config.deny;
  if (Array.isArray(allow) && allow.length) {
    return { allow };
  }
  if (Array.isArray(deny) && deny.length) {
    return { deny };
  }
  return null;
}

function resolveToolPolicies(params: { cfg: crocbotConfig; agentId: string }): {
  sandbox: SandboxToolPolicy | null;
  profile: SandboxToolPolicy | null;
} {
  const sbxCfg = resolveSandboxConfigForAgent(params.cfg, params.agentId);
  const sandbox = resolveSandboxToolPolicyForAgent(params.cfg, params.agentId);
  const agentEntry = params.cfg.agents?.list?.find((a) => a.id === params.agentId);
  const profileName = agentEntry?.tools?.profile ?? params.cfg.tools?.profile;
  const profileRaw = resolveToolProfilePolicy(profileName);
  const profile: SandboxToolPolicy | null = profileRaw
    ? { allow: profileRaw.allow, deny: profileRaw.deny }
    : null;
  const directAllow = pickToolPolicy(
    (sbxCfg as Record<string, unknown> | undefined)?.tools as
      | { allow?: string[]; deny?: string[] }
      | undefined,
  );
  return { sandbox: directAllow ?? sandbox, profile };
}

function hasWebSearchKey(cfg: crocbotConfig, env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    cfg.tools?.web?.search?.apiKey?.trim() ||
    env.TAVILY_API_KEY?.trim() ||
    env.BRAVE_API_KEY?.trim() ||
    env.SERPER_API_KEY?.trim(),
  );
}

function isWebSearchEnabled(cfg: crocbotConfig, env: NodeJS.ProcessEnv): boolean {
  const explicit = cfg.tools?.web?.search?.enabled;
  if (typeof explicit === "boolean") {
    return explicit;
  }
  return hasWebSearchKey(cfg, env);
}

function isWebFetchEnabled(cfg: crocbotConfig): boolean {
  const explicit = cfg.tools?.web?.fetch?.enabled;
  if (typeof explicit === "boolean") {
    return explicit;
  }
  return true;
}

function isBrowserEnabled(cfg: crocbotConfig): boolean {
  const browserCfg = resolveBrowserConfig(cfg.browser, cfg);
  return browserCfg.enabled;
}

function listGroupPolicyOpen(cfg: crocbotConfig): string[] {
  const out: string[] = [];
  const channels = cfg.channels as Record<string, unknown> | undefined;
  if (!channels || typeof channels !== "object") {
    return out;
  }
  for (const [channelId, value] of Object.entries(channels)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const section = value as Record<string, unknown>;
    if (section.groupPolicy === "open") {
      out.push(`channels.${channelId}.groupPolicy`);
    }
    const accounts = section.accounts;
    if (accounts && typeof accounts === "object") {
      for (const [accountId, accountVal] of Object.entries(accounts)) {
        if (!accountVal || typeof accountVal !== "object") {
          continue;
        }
        const acc = accountVal as Record<string, unknown>;
        if (acc.groupPolicy === "open") {
          out.push(`channels.${channelId}.accounts.${accountId}.groupPolicy`);
        }
      }
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Exported collectors
// --------------------------------------------------------------------------

export function collectAttackSurfaceSummaryFindings(cfg: crocbotConfig): SecurityAuditFinding[] {
  const group = summarizeGroupPolicy(cfg);
  const elevated = cfg.tools?.elevated?.enabled !== false;
  const hooksEnabled = cfg.hooks?.enabled === true;
  const browserEnabled = cfg.browser?.enabled ?? true;

  const detail =
    `groups: open=${group.open}, allowlist=${group.allowlist}` +
    `\n` +
    `tools.elevated: ${elevated ? "enabled" : "disabled"}` +
    `\n` +
    `hooks: ${hooksEnabled ? "enabled" : "disabled"}` +
    `\n` +
    `browser control: ${browserEnabled ? "enabled" : "disabled"}`;

  return [
    {
      checkId: "summary.attack_surface",
      severity: "info",
      title: "Attack surface summary",
      detail,
    },
  ];
}

export function collectSyncedFolderFindings(params: {
  stateDir: string;
  configPath?: string;
  workspaceDir?: string;
}): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const paths = [params.stateDir, params.configPath, params.workspaceDir].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  for (const p of paths) {
    if (isProbablySyncedPath(p)) {
      findings.push({
        checkId: "env.synced_folder",
        severity: "warn",
        title: "Path appears to be inside a synced/cloud folder",
        detail: `Path ${p} looks like it's inside an iCloud, Dropbox, Google Drive, or OneDrive folder.`,
        remediation:
          "Move state/config to a non-synced directory, or set CROCBOT_HOME to override the default.",
      });
    }
  }
  return findings;
}

export function collectSecretsInConfigFindings(cfg: crocbotConfig): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const auth = resolveGatewayAuth({ authConfig: cfg.gateway?.auth });
  if (auth.mode === "password" && auth.password && !looksLikeEnvRef(auth.password)) {
    findings.push({
      checkId: "secrets.gateway_password",
      severity: "warn",
      title: "Gateway password stored in config plaintext",
      detail:
        "gateway.auth.password is set as a literal string. Anyone who can read the config file can authenticate.",
      remediation:
        "Use an environment variable reference ($GATEWAY_PASSWORD) or switch to token-based gateway auth.",
    });
  }
  const hooksToken = typeof cfg.hooks?.token === "string" ? cfg.hooks.token.trim() : "";
  if (hooksToken && !looksLikeEnvRef(hooksToken)) {
    findings.push({
      checkId: "secrets.hooks_token",
      severity: "warn",
      title: "Hooks bearer token stored in config plaintext",
      detail:
        "hooks.token is set as a literal string. Exfiltrating the config file exposes this credential.",
      remediation: "Use an environment variable reference ($HOOKS_TOKEN).",
    });
  }
  return findings;
}

export function collectHooksHardeningFindings(cfg: crocbotConfig): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const hooksEnabled = cfg.hooks?.enabled === true;
  if (!hooksEnabled) {
    return findings;
  }
  const hooksToken = typeof cfg.hooks?.token === "string" ? cfg.hooks.token.trim() : "";
  if (hooksToken && hooksToken.length < 16) {
    findings.push({
      checkId: "hooks.short_token",
      severity: "warn",
      title: "Hooks bearer token is short (<16 chars)",
      detail: `Token length: ${hooksToken.length}. Short tokens are easy to brute-force.`,
      remediation: "Regenerate with at least 32 random characters (e.g. `openssl rand -hex 16`).",
    });
  }
  const gatewayAuth = resolveGatewayAuth({ authConfig: cfg.gateway?.auth });
  if (hooksToken && gatewayAuth.mode === "token" && gatewayAuth.token === hooksToken) {
    findings.push({
      checkId: "hooks.reused_gateway_token",
      severity: "critical",
      title: "Hooks token reuses a gateway connect token",
      detail: "Hooks and gateway use the same bearer token. Compromising one compromises both.",
      remediation: "Use a unique, random token for hooks.",
    });
  }
  const hooksList = cfg.hooks?.mappings;
  if (Array.isArray(hooksList)) {
    const catchAll = hooksList.some(
      (h) => h && typeof h === "object" && (h as Record<string, unknown>).path === "/",
    );
    if (catchAll) {
      findings.push({
        checkId: "hooks.catch_all_path",
        severity: "warn",
        title: 'Hook with path="/" registered',
        detail:
          'A catch-all path ("/") forwards every gateway request to the hook URL. If the hook is not secured, any request can be proxied.',
        remediation:
          "Narrow the path to only the routes you actually need (e.g. /agent, /sessions).",
      });
    }
  }
  return findings;
}

export function collectModelHygieneFindings(cfg: crocbotConfig): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const models = collectModels(cfg);
  if (models.length === 0) {
    return findings;
  }
  for (const { id, source } of models) {
    for (const { re, label } of LEGACY_MODEL_PATTERNS) {
      if (re.test(id)) {
        findings.push({
          checkId: "model.legacy",
          severity: "warn",
          title: `Legacy model detected: ${label}`,
          detail: `Model "${id}" (${source}) is a legacy model with known limitations and deprecation.`,
          remediation: `Upgrade to a modern model (e.g. gpt-4o, claude-sonnet-4-5, gemini-2.5-pro).`,
        });
      }
    }
    for (const { re, label } of WEAK_TIER_MODEL_PATTERNS) {
      if (re.test(id)) {
        findings.push({
          checkId: "model.weak_tier",
          severity: "info",
          title: `Weaker-tier model: ${label}`,
          detail: `Model "${id}" (${source}) is a lightweight/speed-tier model. Instruction-following and safety behavior may be weaker.`,
          remediation: `For security-sensitive tasks, prefer a full-size model.`,
        });
      }
    }
  }
  return findings;
}

export function collectSmallModelRiskFindings(params: {
  cfg: crocbotConfig;
  env: NodeJS.ProcessEnv;
}): SecurityAuditFinding[] {
  const { cfg, env } = params;
  const findings: SecurityAuditFinding[] = [];
  const models = collectModels(cfg);
  if (models.length === 0) {
    return findings;
  }

  const webSearch = isWebSearchEnabled(cfg, env);
  const webFetch = isWebFetchEnabled(cfg);
  const browser = isBrowserEnabled(cfg);
  const hasExternalTools = webSearch || webFetch || browser;

  for (const { id, source } of models) {
    if (isGptModel(id) && isGpt5OrHigher(id)) {
      continue;
    }
    if (isClaudeModel(id) && isClaude45OrHigher(id)) {
      continue;
    }
    const paramB = inferParamBFromIdOrName(id);
    if (paramB === null || paramB >= SMALL_MODEL_PARAM_B_MAX) {
      continue;
    }
    const agentId = extractAgentIdFromSource(source) ?? "default";
    const { sandbox, profile } = resolveToolPolicies({ cfg, agentId });

    const policies = [sandbox, profile].filter(Boolean) as SandboxToolPolicy[];
    const sandboxBlocks = policies.length > 0 && !isToolAllowedByPolicies("exec", policies);
    if (sandboxBlocks) {
      continue;
    }

    const webBlocked =
      policies.length > 0 &&
      !isToolAllowedByPolicies("web_search", policies) &&
      !isToolAllowedByPolicies("web_fetch", policies);
    const browserBlocked = policies.length > 0 && !isToolAllowedByPolicies("browser", policies);
    if (webBlocked && browserBlocked) {
      continue;
    }

    const exposure: string[] = [];
    if (hasExternalTools && !webBlocked) {
      exposure.push("web_search/web_fetch");
    }
    if (browser && !browserBlocked) {
      exposure.push("browser");
    }
    if (!sandboxBlocks) {
      exposure.push("exec (sandboxed commands)");
    }
    if (exposure.length === 0) {
      continue;
    }

    findings.push({
      checkId: "model.small_params_exposure",
      severity: "warn",
      title: `Small model (${paramB}B params) with tool exposure`,
      detail:
        `Model "${id}" (${source}) has ~${paramB}B parameters. ` +
        `Small models are more susceptible to prompt injection and may not follow safety instructions reliably. ` +
        `Exposed tools: ${exposure.join(", ")}.`,
      remediation:
        'If you must use small models, enable sandboxing for all sessions (agents.defaults.sandbox.mode="all") and disable web_search/web_fetch/browser (tools.deny=["group:web","browser"]).',
    });
  }

  return findings;
}

export function collectExposureMatrixFindings(cfg: crocbotConfig): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const openGroups = listGroupPolicyOpen(cfg);
  if (openGroups.length === 0) {
    return findings;
  }

  const elevatedEnabled = cfg.tools?.elevated?.enabled !== false;
  if (elevatedEnabled) {
    findings.push({
      checkId: "security.exposure.open_groups_with_elevated",
      severity: "critical",
      title: "Open groupPolicy with elevated tools enabled",
      detail:
        `Found groupPolicy="open" at:\n${openGroups.map((p) => `- ${p}`).join("\n")}\n` +
        "With tools.elevated enabled, a prompt injection in those rooms can become a high-impact incident.",
      remediation: `Set groupPolicy="allowlist" and keep elevated allowlists extremely tight.`,
    });
  }

  return findings;
}
