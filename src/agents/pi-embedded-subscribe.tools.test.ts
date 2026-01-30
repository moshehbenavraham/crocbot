import { beforeEach, describe, expect, it } from "vitest";

import { extractMessagingToolSend } from "./pi-embedded-subscribe.tools.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createGenericTestPlugin, createTestRegistry } from "../test-utils/channel-plugins.js";

describe("extractMessagingToolSend", () => {
  beforeEach(() => {
    const telegramPlugin = createGenericTestPlugin({ id: "telegram" });
    setActivePluginRegistry(
      createTestRegistry([{ pluginId: "telegram", plugin: telegramPlugin, source: "test" }]),
    );
  });

  it("uses channel as provider for message tool", () => {
    const result = extractMessagingToolSend("message", {
      action: "send",
      channel: "telegram",
      to: "123",
    });

    expect(result?.tool).toBe("message");
    expect(result?.provider).toBe("telegram");
    // Target is not prefixed when channel is already specified
    expect(result?.to).toBe("123");
  });

  it("prefers provider when both provider and channel are set", () => {
    const result = extractMessagingToolSend("message", {
      action: "send",
      provider: "telegram",
      channel: "telegram",
      to: "123",
    });

    expect(result?.tool).toBe("message");
    expect(result?.provider).toBe("telegram");
    // Target is not prefixed when provider is already specified
    expect(result?.to).toBe("123");
  });
});
