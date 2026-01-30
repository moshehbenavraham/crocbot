import { describe, expect, it } from "vitest";

import type { crocbotConfig } from "../../config/config.js";
import { resolveOutboundSessionRoute } from "./outbound-session.js";

const baseConfig = {} as crocbotConfig;

describe("resolveOutboundSessionRoute", () => {
  it("uses Telegram topic ids in group session keys", async () => {
    const route = await resolveOutboundSessionRoute({
      cfg: baseConfig,
      channel: "telegram",
      agentId: "main",
      target: "-100123456:topic:42",
    });

    expect(route?.sessionKey).toBe("agent:main:telegram:group:-100123456:topic:42");
    expect(route?.from).toBe("telegram:group:-100123456:topic:42");
    expect(route?.to).toBe("telegram:-100123456");
    expect(route?.threadId).toBe(42);
  });

  it("treats Telegram usernames as DMs when unresolved", async () => {
    const cfg = { session: { dmScope: "per-channel-peer" } } as crocbotConfig;
    const route = await resolveOutboundSessionRoute({
      cfg,
      channel: "telegram",
      agentId: "main",
      target: "@alice",
    });

    expect(route?.sessionKey).toBe("agent:main:telegram:dm:@alice");
    expect(route?.chatType).toBe("direct");
  });

  it("treats Zalo Personal DM targets as direct sessions", async () => {
    const cfg = { session: { dmScope: "per-channel-peer" } } as crocbotConfig;
    const route = await resolveOutboundSessionRoute({
      cfg,
      channel: "zalouser",
      agentId: "main",
      target: "123456",
    });

    expect(route?.sessionKey).toBe("agent:main:zalouser:dm:123456");
    expect(route?.chatType).toBe("direct");
  });
});
