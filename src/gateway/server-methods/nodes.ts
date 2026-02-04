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
    respond(true, { items: [] }, undefined);
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
    respond(true, { items: [] }, undefined);
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
    respond(true, { items: [] }, undefined);
  },
  "node.describe": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.invoke": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.invoke.result": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
  "node.event": async ({ respond }) => {
    respond(false, undefined, FEATURE_DISABLED_ERROR);
  },
};
