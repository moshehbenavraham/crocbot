import type { OutboundSendDeps } from "../infra/outbound/deliver.js";
import { sendMessageTelegram } from "../telegram/send.js";

export type CliDeps = {
  sendMessageTelegram: typeof sendMessageTelegram;
};

export function createDefaultDeps(): CliDeps {
  return {
    sendMessageTelegram,
  };
}

// Provider docking: extend this mapping when adding new outbound send deps.
export function createOutboundSendDeps(deps: CliDeps): OutboundSendDeps {
  return {
    sendTelegram: deps.sendMessageTelegram,
  };
}
