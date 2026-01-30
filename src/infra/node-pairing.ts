// Node pairing removed - stubs for compatibility

export type PairedNode = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  remoteIp?: string;
  createdAtMs?: number;
  lastConnectedAtMs?: number;
  bins?: Set<string>;
};

export type NodePairingRequest = {
  requestId: string;
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  remoteIp?: string;
  silent?: boolean;
  createdAtMs: number;
};

export async function listNodePairing(): Promise<{
  pending: NodePairingRequest[];
  paired: PairedNode[];
}> {
  return { pending: [], paired: [] };
}

export async function requestNodePairing(opts: {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  remoteIp?: string;
  silent?: boolean;
}): Promise<{ status: "pending" | "approved"; created: boolean; request: NodePairingRequest }> {
  return {
    status: "approved",
    created: false,
    request: {
      requestId: `stub-${Date.now()}`,
      nodeId: opts.nodeId,
      displayName: opts.displayName,
      platform: opts.platform,
      version: opts.version,
      coreVersion: opts.coreVersion,
      uiVersion: opts.uiVersion,
      deviceFamily: opts.deviceFamily,
      modelIdentifier: opts.modelIdentifier,
      caps: opts.caps,
      commands: opts.commands,
      remoteIp: opts.remoteIp,
      silent: opts.silent,
      createdAtMs: Date.now(),
    },
  };
}

export async function approveNodePairing(_requestId: string): Promise<{ node: PairedNode } | null> {
  return null;
}

export async function rejectNodePairing(_requestId: string): Promise<{ nodeId: string } | null> {
  return null;
}

export async function verifyNodeToken(
  _nodeId: string,
  _token: string,
): Promise<{ ok: boolean; reason?: string }> {
  return { ok: true };
}

export async function renamePairedNode(
  _nodeId: string,
  _displayName: string,
): Promise<{ nodeId: string; displayName: string } | null> {
  return null;
}

export async function updatePairedNodeMetadata(
  _nodeId: string,
  _metadata: Partial<{ lastConnectedAtMs?: number }>,
): Promise<void> {}
