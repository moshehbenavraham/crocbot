import type {
  ChannelCapabilities,
  ChannelId,
  ChannelOutboundAdapter,
  ChannelPlugin,
} from "../channels/plugins/types.js";
import type { PluginRegistry } from "../plugins/registry.js";

export const createTestRegistry = (channels: PluginRegistry["channels"] = []): PluginRegistry => ({
  plugins: [],
  tools: [],
  hooks: [],
  typedHooks: [],
  channels,
  providers: [],
  gatewayHandlers: {},
  httpHandlers: [],
  httpRoutes: [],
  cliRegistrars: [],
  services: [],
  commands: [],
  diagnostics: [],
});

export const createOutboundTestPlugin = (params: {
  id: ChannelId;
  outbound: ChannelOutboundAdapter;
  label?: string;
  docsPath?: string;
  capabilities?: ChannelCapabilities;
}): ChannelPlugin => ({
  id: params.id,
  meta: {
    id: params.id,
    label: params.label ?? String(params.id),
    selectionLabel: params.label ?? String(params.id),
    docsPath: params.docsPath ?? `/channels/${params.id}`,
    blurb: "test stub.",
  },
  capabilities: params.capabilities ?? { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => [],
    resolveAccount: () => ({}),
  },
  outbound: params.outbound,
});

/**
 * Creates a generic test channel plugin for use in tests.
 * This replaces the removed createIMessageTestPlugin.
 */
export const createGenericTestPlugin = (params?: {
  id?: ChannelId;
  outbound?: ChannelOutboundAdapter;
  label?: string;
  aliases?: string[];
  capabilities?: ChannelCapabilities;
}): ChannelPlugin => {
  const id = params?.id ?? "telegram";
  const defaultOutbound: ChannelOutboundAdapter = {
    deliveryMode: "direct",
    sendText: async (ctx) => ({
      channel: id,
      messageId: `msg-${Date.now()}`,
      to: ctx.to,
    }),
    sendMedia: async (ctx) => ({
      channel: id,
      messageId: `media-msg-${Date.now()}`,
      to: ctx.to,
    }),
  };
  return {
    id,
    meta: {
      id,
      label: params?.label ?? "Test Channel",
      selectionLabel: params?.label ?? "Test Channel",
      docsPath: `/channels/${id}`,
      blurb: "Test channel stub.",
      aliases: params?.aliases,
    },
    capabilities: params?.capabilities ?? { chatTypes: ["direct", "group"], media: true },
    config: {
      listAccountIds: () => [],
      resolveAccount: () => ({}),
    },
    status: {
      collectStatusIssues: (accounts) =>
        accounts.flatMap((account) => {
          const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
          if (!lastError) return [];
          return [
            {
              channel: id,
              accountId: account.accountId,
              kind: "runtime",
              message: `Channel error: ${lastError}`,
            },
          ];
        }),
    },
    outbound: params?.outbound ?? defaultOutbound,
    messaging: {
      normalizeTarget: (raw) => raw.trim(),
    },
  };
};

/**
 * Alias for backward compatibility - use createGenericTestPlugin instead
 * @deprecated Use createGenericTestPlugin
 */
export const createIMessageTestPlugin = createGenericTestPlugin;
