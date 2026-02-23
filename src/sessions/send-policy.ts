import type { crocbotConfig } from "../config/config.js";
import type { SessionChatType, SessionEntry } from "../config/sessions.js";
import { normalizeChatType } from "../channels/chat-type.js";

export type SessionSendPolicyDecision = "allow" | "deny";

export function normalizeSendPolicy(raw?: string | null): SessionSendPolicyDecision | undefined {
  const value = raw?.trim().toLowerCase();
  if (value === "allow") {
    return "allow";
  }
  if (value === "deny") {
    return "deny";
  }
  return undefined;
}

function normalizeMatchValue(raw?: string | null) {
  const value = raw?.trim().toLowerCase();
  return value ? value : undefined;
}

/**
 * Strip the `agent:<agentId>:` prefix from a canonical session key
 * so channel/chatType derivation works against the bare key portion.
 */
function stripAgentSessionKeyPrefix(key?: string): string | undefined {
  if (!key) {
    return undefined;
  }
  const parts = key.split(":").filter(Boolean);
  if (parts.length >= 3 && parts[0] === "agent") {
    return parts.slice(2).join(":");
  }
  return key;
}

function deriveChannelFromKey(key?: string) {
  const stripped = stripAgentSessionKeyPrefix(key);
  if (!stripped) {
    return undefined;
  }
  const parts = stripped.split(":").filter(Boolean);
  if (parts.length >= 3 && (parts[1] === "group" || parts[1] === "channel")) {
    return normalizeMatchValue(parts[0]);
  }
  return undefined;
}

function deriveChatTypeFromKey(key?: string): SessionChatType | undefined {
  const stripped = stripAgentSessionKeyPrefix(key);
  if (!stripped) {
    return undefined;
  }
  if (stripped.includes(":group:")) {
    return "group";
  }
  if (stripped.includes(":channel:")) {
    return "channel";
  }
  return undefined;
}

export function resolveSendPolicy(params: {
  cfg: crocbotConfig;
  entry?: SessionEntry;
  sessionKey?: string;
  channel?: string;
  chatType?: SessionChatType;
}): SessionSendPolicyDecision {
  const override = normalizeSendPolicy(params.entry?.sendPolicy);
  if (override) {
    return override;
  }

  const policy = params.cfg.session?.sendPolicy;
  if (!policy) {
    return "allow";
  }

  const channel =
    normalizeMatchValue(params.channel) ??
    normalizeMatchValue(params.entry?.channel) ??
    normalizeMatchValue(params.entry?.lastChannel) ??
    deriveChannelFromKey(params.sessionKey);
  const chatType =
    normalizeChatType(params.chatType ?? params.entry?.chatType) ??
    normalizeChatType(deriveChatTypeFromKey(params.sessionKey));
  const rawSessionKey = params.sessionKey ?? "";
  const strippedSessionKey = stripAgentSessionKeyPrefix(rawSessionKey) ?? rawSessionKey;

  let allowedMatch = false;
  for (const rule of policy.rules ?? []) {
    if (!rule) {
      continue;
    }
    const action = normalizeSendPolicy(rule.action) ?? "allow";
    const match = rule.match ?? {};
    const matchChannel = normalizeMatchValue(match.channel);
    const matchChatType = normalizeChatType(match.chatType);
    const matchPrefix = normalizeMatchValue(match.keyPrefix);

    if (matchChannel && matchChannel !== channel) {
      continue;
    }
    if (matchChatType && matchChatType !== chatType) {
      continue;
    }
    if (
      matchPrefix &&
      !rawSessionKey.startsWith(matchPrefix) &&
      !strippedSessionKey.startsWith(matchPrefix)
    ) {
      continue;
    }
    if (action === "deny") {
      return "deny";
    }
    allowedMatch = true;
  }

  if (allowedMatch) {
    return "allow";
  }

  const fallback = normalizeSendPolicy(policy.default);
  return fallback ?? "allow";
}
