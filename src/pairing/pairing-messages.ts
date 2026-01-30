// Pairing messages removed - stubs for compatibility

export const PAIRING_REQUEST_MESSAGE = "";
export const PAIRING_APPROVED_MESSAGE = "";
export const PAIRING_REJECTED_MESSAGE = "";
export const PAIRING_DM_INSTRUCTION = "";

export function formatPairingRequestMessage(_displayName?: string): string {
  return "";
}

export function formatPairingApprovedMessage(_displayName?: string): string {
  return "";
}

export function formatPairingRejectedMessage(_displayName?: string): string {
  return "";
}

export type PairingReplyOptions = {
  channel: string;
  peerId: string;
  displayName?: string;
  code?: string;
};

export function buildPairingReply(_opts: PairingReplyOptions): string {
  return "";
}
