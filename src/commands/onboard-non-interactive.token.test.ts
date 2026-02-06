import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

describe("onboard (non-interactive): token auth", () => {
  it("writes token profile config and stores the token", async () => {
    const prev = {
      home: process.env.HOME,
      stateDir: process.env.CROCBOT_STATE_DIR,
      configPath: process.env.CROCBOT_CONFIG_PATH,
      skipChannels: process.env.CROCBOT_SKIP_CHANNELS,
      skipGmail: process.env.CROCBOT_SKIP_GMAIL_WATCHER,
      skipCron: process.env.CROCBOT_SKIP_CRON,
      token: process.env.CROCBOT_GATEWAY_TOKEN,
      password: process.env.CROCBOT_GATEWAY_PASSWORD,
    };

    process.env.CROCBOT_SKIP_CHANNELS = "1";
    process.env.CROCBOT_SKIP_GMAIL_WATCHER = "1";
    process.env.CROCBOT_SKIP_CRON = "1";
    delete process.env.CROCBOT_GATEWAY_TOKEN;
    delete process.env.CROCBOT_GATEWAY_PASSWORD;

    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-onboard-token-"));
    process.env.HOME = tempHome;
    process.env.CROCBOT_STATE_DIR = tempHome;
    process.env.CROCBOT_CONFIG_PATH = path.join(tempHome, "crocbot.json");
    vi.resetModules();

    const token = `sk-ant-oat01-${"a".repeat(80)}`;

    const runtime = {
      log: () => {},
      error: (msg: string) => {
        throw new Error(msg);
      },
      exit: (code: number) => {
        throw new Error(`exit:${code}`);
      },
    };

    try {
      const { runNonInteractiveOnboarding } = await import("./onboard-non-interactive.js");
      await runNonInteractiveOnboarding(
        {
          nonInteractive: true,
          authChoice: "token",
          tokenProvider: "anthropic",
          token,
          tokenProfileId: "anthropic:default",
          skipHealth: true,
          skipChannels: true,
          json: true,
        },
        runtime,
      );

      const { CONFIG_PATH } = await import("../config/config.js");
      const cfg = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8")) as {
        auth?: {
          profiles?: Record<string, { provider?: string; mode?: string }>;
        };
      };

      expect(cfg.auth?.profiles?.["anthropic:default"]?.provider).toBe("anthropic");
      expect(cfg.auth?.profiles?.["anthropic:default"]?.mode).toBe("token");

      const { ensureAuthProfileStore } = await import("../agents/auth-profiles.js");
      const store = ensureAuthProfileStore();
      const profile = store.profiles["anthropic:default"];
      expect(profile?.type).toBe("token");
      if (profile?.type === "token") {
        expect(profile.provider).toBe("anthropic");
        expect(profile.token).toBe(token);
      }
    } finally {
      await fs.rm(tempHome, { recursive: true, force: true });
      process.env.HOME = prev.home;
      process.env.CROCBOT_STATE_DIR = prev.stateDir;
      process.env.CROCBOT_CONFIG_PATH = prev.configPath;
      process.env.CROCBOT_SKIP_CHANNELS = prev.skipChannels;
      process.env.CROCBOT_SKIP_GMAIL_WATCHER = prev.skipGmail;
      process.env.CROCBOT_SKIP_CRON = prev.skipCron;
      process.env.CROCBOT_GATEWAY_TOKEN = prev.token;
      process.env.CROCBOT_GATEWAY_PASSWORD = prev.password;
    }
  }, 60_000);
});
