// Channel pairing removed - stubs for compatibility

import type { crocbotConfig } from "../../config/config.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { ChannelId } from "./index.js";
import type { ChannelPairingAdapter } from "./types.js";

export function listPairingChannels(): ChannelId[] {
  return [];
}

export function getPairingAdapter(_channelId: ChannelId): ChannelPairingAdapter | null {
  return null;
}

export function requirePairingAdapter(_channelId: ChannelId): ChannelPairingAdapter {
  throw new Error("Pairing has been removed");
}

export function resolvePairingChannel(_raw: unknown): ChannelId {
  throw new Error("Pairing has been removed");
}

export async function notifyPairingApproved(_params: {
  channelId: ChannelId;
  id: string;
  cfg: crocbotConfig;
  runtime?: RuntimeEnv;
  pairingAdapter?: ChannelPairingAdapter;
}): Promise<void> {}
