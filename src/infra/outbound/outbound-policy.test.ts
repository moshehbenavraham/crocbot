import { describe, expect, it } from "vitest";

import type { crocbotConfig } from "../../config/config.js";
import {
  applyCrossContextDecoration,
  buildCrossContextDecoration,
  enforceCrossContextPolicy,
} from "./outbound-policy.js";

const telegramConfig = {
  channels: {
    telegram: {
      botToken: "123:abc",
    },
  },
} as crocbotConfig;

describe("outbound policy", () => {
  it("blocks cross-provider sends by default", () => {
    expect(() =>
      enforceCrossContextPolicy({
        cfg: telegramConfig,
        channel: "whatsapp",
        action: "send",
        args: { to: "whatsapp:+15555550123" },
        toolContext: { currentChannelId: "123456789", currentChannelProvider: "telegram" },
      }),
    ).toThrow(/Cross-context messaging denied/);
  });

  it("allows cross-provider sends when enabled", () => {
    const cfg = {
      ...telegramConfig,
      tools: {
        message: { crossContext: { allowAcrossProviders: true } },
      },
    } as crocbotConfig;

    expect(() =>
      enforceCrossContextPolicy({
        cfg,
        channel: "whatsapp",
        action: "send",
        args: { to: "whatsapp:+15555550123" },
        toolContext: { currentChannelId: "123456789", currentChannelProvider: "telegram" },
      }),
    ).not.toThrow();
  });

  it("blocks same-provider cross-context when disabled", () => {
    const cfg = {
      ...telegramConfig,
      tools: { message: { crossContext: { allowWithinProvider: false } } },
    } as crocbotConfig;

    expect(() =>
      enforceCrossContextPolicy({
        cfg,
        channel: "telegram",
        action: "send",
        args: { to: "987654321" },
        toolContext: { currentChannelId: "123456789", currentChannelProvider: "telegram" },
      }),
    ).toThrow(/Cross-context messaging denied/);
  });

  it("falls back to text prefix when no embeds available", async () => {
    const decoration = await buildCrossContextDecoration({
      cfg: telegramConfig,
      channel: "telegram",
      target: "987654321",
      toolContext: { currentChannelId: "123456789", currentChannelProvider: "telegram" },
    });

    expect(decoration).not.toBeNull();
    const applied = applyCrossContextDecoration({
      message: "hello",
      decoration: decoration!,
      preferEmbeds: true,
    });

    // Telegram does not support embeds, so usedEmbeds should be false
    // and the message gets a text prefix
    expect(applied.usedEmbeds).toBe(false);
    expect(applied.message).toContain("hello");
    expect(applied.message).toMatch(/\[from/);
  });
});
