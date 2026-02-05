// Node/Device gateway method stubs
// These methods were part of the mobile/node ecosystem that was stripped out.
// Stubs return appropriate disabled responses to prevent "unknown method" errors.

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const FEATURE_DISABLED_ERROR = errorShape(
  ErrorCodes.INVALID_REQUEST,
  "Node/device functionality is not available in this deployment",
);

export const nodesHandlers: GatewayRequestHandlers = {
  // Node pairing methods
  "node.pair.request": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.pair.list": async ({ respond }) => {
    // Return { pending: [], paired: [] } to match client expectations (format.ts, nodes-utils.ts)
    respond(true, { pending: [], paired: [] }, undefined);
  },
  "node.pair.approve": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.pair.reject": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.pair.verify": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },

  // Device pairing methods
  "device.pair.list": async ({ respond }) => {
    // Return { pending: [], paired: [] } to match expected pairing list format
    respond(true, { pending: [], paired: [] }, undefined);
  },
  "device.pair.approve": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "device.pair.reject": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "device.token.rotate": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "device.token.revoke": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },

  // Node management methods
  "node.rename": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.list": async ({ respond }) => {
    // Return { nodes: [] } to match client expectations (format.ts, nodes-utils.ts)
    respond(true, { nodes: [] }, undefined);
  },
  "node.describe": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.invoke": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.invoke.result": async ({ respond }) => {
    // Late-arriving invoke results are silently accepted to reduce log noise.
    respond(true, { ok: true, ignored: true }, undefined);
  },
  "node.event": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
};
