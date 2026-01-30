import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENT_MAX_CONCURRENT, DEFAULT_SUBAGENT_MAX_CONCURRENT } from "./agent-limits.js";
import { withTempHome } from "./test-helpers.js";

describe("config identity defaults", () => {
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.HOME;
  });

  afterEach(() => {
    process.env.HOME = previousHome;
  });

  it("does not derive mentionPatterns when identity is set", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            agents: {
              list: [
                {
                  id: "main",
                  identity: {
                    name: "Samantha",
                    theme: "helpful sloth",
                    emoji: "🦥",
                  },
                },
              ],
            },
            messages: {},
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.messages?.responsePrefix).toBeUndefined();
      expect(cfg.messages?.groupChat?.mentionPatterns).toBeUndefined();
    });
  });

  it("defaults ackReactionScope without setting ackReaction", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            agents: {
              list: [
                {
                  id: "main",
                  identity: {
                    name: "Samantha",
                    theme: "helpful sloth",
                    emoji: "🦥",
                  },
                },
              ],
            },
            messages: {},
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.messages?.ackReaction).toBeUndefined();
      expect(cfg.messages?.ackReactionScope).toBe("group-mentions");
    });
  });

  it("keeps ackReaction unset when identity is missing", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            messages: {},
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.messages?.ackReaction).toBeUndefined();
      expect(cfg.messages?.ackReactionScope).toBe("group-mentions");
    });
  });

  it("does not override explicit values", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            agents: {
              list: [
                {
                  id: "main",
                  identity: {
                    name: "Samantha Sloth",
                    theme: "chrome crocodile",
                    emoji: "🐊",
                  },
                  groupChat: { mentionPatterns: ["@croc"] },
                },
              ],
            },
            messages: {
              responsePrefix: "✅",
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.messages?.responsePrefix).toBe("✅");
      expect(cfg.agents?.list?.[0]?.groupChat?.mentionPatterns).toEqual(["@croc"]);
    });
  });

  it("supports provider textChunkLimit config", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            messages: {
              messagePrefix: "[crocbot]",
              responsePrefix: "🐊",
            },
            channels: {
              telegram: { enabled: true, textChunkLimit: 3333 },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.channels?.telegram?.textChunkLimit).toBe(3333);

      const legacy = (cfg.messages as unknown as Record<string, unknown>).textChunkLimit;
      expect(legacy).toBeUndefined();
    });
  });

  it("accepts blank model provider apiKey values", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            models: {
              mode: "merge",
              providers: {
                minimax: {
                  baseUrl: "https://api.minimax.io/anthropic",
                  apiKey: "",
                  api: "anthropic-messages",
                  models: [
                    {
                      id: "MiniMax-M2.1",
                      name: "MiniMax M2.1",
                      reasoning: false,
                      input: ["text"],
                      cost: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                      },
                      contextWindow: 200000,
                      maxTokens: 8192,
                    },
                  ],
                },
              },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.models?.providers?.minimax?.baseUrl).toBe("https://api.minimax.io/anthropic");
    });
  });

  it("respects empty responsePrefix to disable identity defaults", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            agents: {
              list: [
                {
                  id: "main",
                  identity: {
                    name: "Samantha",
                    theme: "helpful sloth",
                    emoji: "🦥",
                  },
                },
              ],
            },
            messages: { responsePrefix: "" },
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.messages?.responsePrefix).toBe("");
    });
  });

  it("does not synthesize agent list/session when absent", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            messages: {},
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.messages?.responsePrefix).toBeUndefined();
      expect(cfg.messages?.groupChat?.mentionPatterns).toBeUndefined();
      expect(cfg.agents?.list).toBeUndefined();
      expect(cfg.agents?.defaults?.maxConcurrent).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
      expect(cfg.agents?.defaults?.subagents?.maxConcurrent).toBe(DEFAULT_SUBAGENT_MAX_CONCURRENT);
      expect(cfg.session).toBeUndefined();
    });
  });

  it("does not derive responsePrefix from identity emoji", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".crocbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "crocbot.json"),
        JSON.stringify(
          {
            agents: {
              list: [
                {
                  id: "main",
                  identity: {
                    name: "Croc",
                    theme: "chrome crocodile",
                    emoji: "🐊",
                  },
                },
              ],
            },
            messages: {},
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.messages?.responsePrefix).toBeUndefined();
    });
  });
});
