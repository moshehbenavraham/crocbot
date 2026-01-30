// Pairing store removed - stubs for compatibility

export type PairingChannel = string;
export type PairingContext = { channel: PairingChannel; peerId: string };

export interface PairingEntry {
  channel: PairingChannel;
  id: string;
  peerId: string;
  displayName?: string;
  createdAt: string;
  approvedAt?: string;
  status: "pending" | "approved" | "rejected";
}

export interface PairingRequest extends PairingEntry {}
export interface PairedPeer extends PairingEntry {}

export type ChannelAllowFromStore = Map<string, { peerId: string; addedAt: string }>;

export function getAllPairingRequests(): PairingEntry[] {
  return [];
}

export function getPairingRequest(
  _channel: PairingChannel,
  _id: string,
): PairingRequest | undefined {
  return undefined;
}

export function getAllPairedPeers(): PairedPeer[] {
  return [];
}

export function getPairedPeer(_channel: PairingChannel, _peerId: string): PairedPeer | undefined {
  return undefined;
}

export function createPairingRequest(_opts: {
  channel: PairingChannel;
  peerId: string;
  displayName?: string;
}): PairingRequest {
  throw new Error("Pairing has been removed");
}

export function approvePairingRequest(
  _channel: PairingChannel,
  _id: string,
): PairedPeer | undefined {
  return undefined;
}

export function rejectPairingRequest(
  _channel: PairingChannel,
  _id: string,
): PairingRequest | undefined {
  return undefined;
}

export function removePairedPeer(
  _channel: PairingChannel,
  _peerId: string,
): PairedPeer | undefined {
  return undefined;
}

export function isPeerAllowed(_channel: PairingChannel, _peerId: string): boolean {
  return true;
}

export function hasAnyPairings(): boolean {
  return false;
}

export function countPairings(): number {
  return 0;
}

export function listPairings(): PairingEntry[] {
  return [];
}

export function hasPendingRequests(): boolean {
  return false;
}

export function countPendingRequests(): number {
  return 0;
}

export function listPendingRequests(): PairingEntry[] {
  return [];
}

export async function readChannelAllowFromStore(
  _channel: string,
  _env?: NodeJS.ProcessEnv,
): Promise<string[]> {
  return [];
}

export async function addChannelAllowFromStoreEntry(_opts: {
  channel: string;
  entry: string | number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; allowFrom: string[] }> {
  return { changed: false, allowFrom: [] };
}

export async function removeChannelAllowFromStoreEntry(_opts: {
  channel: string;
  entry: string | number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; allowFrom: string[] }> {
  return { changed: false, allowFrom: [] };
}

export function upsertChannelPairingRequest(
  _channel: string,
  _opts: {
    peerId: string;
    displayName?: string;
    code?: string;
  },
): { request: PairingRequest; created: boolean } {
  const request: PairingRequest = {
    channel: _channel,
    id: `stub-${Date.now()}`,
    peerId: _opts.peerId,
    displayName: _opts.displayName,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  return { request, created: false };
}

export function listChannelPairingRequests(_channel: string): PairingRequest[] {
  return [];
}

export function approveChannelPairingCode(
  _channel: string,
  _code: string,
): { approved: boolean; request?: PairingRequest } {
  return { approved: false };
}
