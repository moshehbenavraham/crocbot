import { describe, expect, it } from "vitest";

import { slackPlugin } from "./channel.js";

describe("slack channel plugin (read-only)", () => {
  describe("actions", () => {
    it("listActions returns empty array", () => {
      expect(slackPlugin.actions.listActions()).toEqual([]);
    });

    it("handleAction throws for any action", async () => {
      await expect(
        slackPlugin.actions.handleAction({
          action: "send",
          cfg: {} as never,
          accountId: "default",
          account: {} as never,
          params: {} as never,
        }),
      ).rejects.toThrow("read-only mode");
    });

    it("handleAction throws for read action", async () => {
      await expect(
        slackPlugin.actions.handleAction({
          action: "read",
          cfg: {} as never,
          accountId: "default",
          account: {} as never,
          params: {} as never,
        }),
      ).rejects.toThrow("read-only mode");
    });
  });

  describe("threading", () => {
    it("resolveReplyToMode returns 'off'", () => {
      const result = slackPlugin.threading!.resolveReplyToMode({
        cfg: {} as never,
        accountId: "default",
        account: {} as never,
      });
      expect(result).toBe("off");
    });
  });

  describe("capabilities", () => {
    it("disables all write-related capabilities", () => {
      expect(slackPlugin.capabilities.reactions).toBe(false);
      expect(slackPlugin.capabilities.threads).toBe(false);
      expect(slackPlugin.capabilities.media).toBe(false);
      expect(slackPlugin.capabilities.nativeCommands).toBe(false);
    });

    it("supports chat types for ingest", () => {
      expect(slackPlugin.capabilities.chatTypes).toEqual(["direct", "group", "channel", "thread"]);
    });
  });

  describe("read-only structure", () => {
    it("has no outbound handler", () => {
      expect((slackPlugin as Record<string, unknown>).outbound).toBeUndefined();
    });

    it("has no pairing handler", () => {
      expect((slackPlugin as Record<string, unknown>).pairing).toBeUndefined();
    });

    it("has no streaming handler", () => {
      expect((slackPlugin as Record<string, unknown>).streaming).toBeUndefined();
    });
  });

  describe("status", () => {
    it("buildChannelSummary includes readOnly: true", () => {
      const summary = slackPlugin.status.buildChannelSummary({
        snapshot: {
          configured: true,
          botTokenSource: "config",
          appTokenSource: "config",
          running: true,
          lastStartAt: null,
          lastStopAt: null,
          lastError: null,
        },
      });
      expect(summary).toMatchObject({ readOnly: true });
    });

    it("buildAccountSnapshot includes readOnly: true", () => {
      const snapshot = slackPlugin.status.buildAccountSnapshot({
        account: {
          accountId: "default",
          name: "test",
          enabled: true,
          botToken: "xoxb-test",
          appToken: "xapp-test",
          botTokenSource: "config" as const,
          appTokenSource: "config" as const,
          config: {},
        } as never,
        runtime: null,
        probe: null,
      });
      expect(snapshot).toMatchObject({ readOnly: true });
    });
  });

  describe("meta", () => {
    it("identifies as slack channel", () => {
      expect(slackPlugin.id).toBe("slack");
    });
  });
});
