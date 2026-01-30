// Telegram pairing store removed - stubs for compatibility

import type { crocbotConfig } from "../config/config.js";

export type TelegramPairingListEntry = {
  chatId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
};

export async function readTelegramAllowFromStore(
  _env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  return [];
}

export async function addTelegramAllowFromStoreEntry(_params: {
  entry: string | number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; allowFrom: string[] }> {
  return { changed: false, allowFrom: [] };
}

export async function listTelegramPairingRequests(
  _env: NodeJS.ProcessEnv = process.env,
): Promise<TelegramPairingListEntry[]> {
  return [];
}

export async function upsertTelegramPairingRequest(_params: {
  chatId: string | number;
  username?: string;
  firstName?: string;
  lastName?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ code: string; created: boolean }> {
  return { code: "", created: false };
}

export async function approveTelegramPairingCode(_params: {
  code: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ chatId: string; entry?: TelegramPairingListEntry } | null> {
  return null;
}

export async function resolveTelegramEffectiveAllowFrom(params: {
  cfg: crocbotConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<{ dm: string[]; group: string[] }> {
  const cfgAllowFrom = (params.cfg.channels?.telegram?.allowFrom ?? [])
    .map((v: unknown) => String(v).trim())
    .filter(Boolean)
    .map((v: string) => v.replace(/^(telegram|tg):/i, ""))
    .filter((v: string) => v !== "*");
  const cfgGroupAllowFrom = (params.cfg.channels?.telegram?.groupAllowFrom ?? [])
    .map((v: unknown) => String(v).trim())
    .filter(Boolean)
    .map((v: string) => v.replace(/^(telegram|tg):/i, ""))
    .filter((v: string) => v !== "*");

  const dm = Array.from(new Set(cfgAllowFrom));
  const group = Array.from(
    new Set(cfgGroupAllowFrom.length > 0 ? cfgGroupAllowFrom : cfgAllowFrom),
  );
  return { dm, group };
}
