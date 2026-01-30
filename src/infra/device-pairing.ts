// Device pairing removed - stubs for compatibility

export type DeviceAuthToken = {
  token: string;
  role: string;
  scopes: string[];
  createdAtMs: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
};

export type PairedDevice = {
  deviceId: string;
  publicKey: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  tokens?: Record<string, DeviceAuthToken>;
};

export type DevicePairingRequest = {
  requestId: string;
  deviceId: string;
  publicKey: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  scopes?: string[];
  remoteIp?: string;
  silent?: boolean;
  createdAtMs: number;
};

export async function listDevicePairing(): Promise<{
  pending: DevicePairingRequest[];
  paired: PairedDevice[];
}> {
  return { pending: [], paired: [] };
}

export async function getPairedDevice(_deviceId: string): Promise<PairedDevice | null> {
  return null;
}

export async function requestDevicePairing(opts: {
  deviceId: string;
  publicKey: string | null;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  scopes?: string[];
  remoteIp?: string;
  silent?: boolean;
}): Promise<{ status: "pending" | "approved"; created: boolean; request: DevicePairingRequest }> {
  return {
    status: "approved",
    created: false,
    request: {
      requestId: `stub-${Date.now()}`,
      deviceId: opts.deviceId,
      publicKey: opts.publicKey ?? "",
      displayName: opts.displayName,
      platform: opts.platform,
      clientId: opts.clientId,
      clientMode: opts.clientMode,
      role: opts.role,
      scopes: opts.scopes,
      remoteIp: opts.remoteIp,
      silent: opts.silent,
      createdAtMs: Date.now(),
    },
  };
}

export async function approveDevicePairing(
  _requestId: string,
): Promise<{ device: PairedDevice } | null> {
  return null;
}

export async function rejectDevicePairing(
  _requestId: string,
): Promise<{ deviceId: string } | null> {
  return null;
}

export async function updatePairedDeviceMetadata(
  _deviceId: string,
  _metadata: Partial<{
    displayName?: string;
    platform?: string;
    clientId?: string;
    clientMode?: string;
    role?: string;
    scopes?: string[];
    remoteIp?: string;
  }>,
): Promise<void> {}

export async function verifyDeviceToken(_opts: {
  deviceId: string;
  token: string;
  role?: string;
  scopes?: string[];
}): Promise<{ ok: boolean; reason?: string }> {
  return { ok: true };
}

export async function ensureDeviceToken(_opts: {
  deviceId: string;
  role: string;
  scopes?: string[];
}): Promise<DeviceAuthToken | null> {
  return null;
}

export async function rotateDeviceToken(_opts: {
  deviceId: string;
  role: string;
  scopes?: string[];
}): Promise<DeviceAuthToken | null> {
  return null;
}

export async function revokeDeviceToken(_opts: {
  deviceId: string;
  role: string;
}): Promise<{ role: string; revokedAtMs: number } | null> {
  return null;
}

export function summarizeDeviceTokens(
  _tokens?: Record<string, DeviceAuthToken>,
): Record<string, { role: string; scopes: string[]; createdAtMs: number }> {
  return {};
}
