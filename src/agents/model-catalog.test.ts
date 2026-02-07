import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { crocbotConfig } from "../config/config.js";
import {
  __setModelCatalogImportForTest,
  loadModelCatalog,
  resetModelCatalogCacheForTest,
} from "./model-catalog.js";

type PiSdkModule = typeof import("@mariozechner/pi-coding-agent");

vi.mock("./models-config.js", () => ({
  ensurecrocbotModelsJson: vi.fn().mockResolvedValue({ agentDir: "/tmp", wrote: false }),
}));

vi.mock("./agent-paths.js", () => ({
  resolvecrocbotAgentDir: () => "/tmp/crocbot",
}));

describe("loadModelCatalog", () => {
  beforeEach(() => {
    resetModelCatalogCacheForTest();
  });

  afterEach(() => {
    __setModelCatalogImportForTest();
    resetModelCatalogCacheForTest();
    vi.restoreAllMocks();
  });

  it("retries after import failure without poisoning the cache", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let call = 0;

    __setModelCatalogImportForTest(async () => {
      call += 1;
      if (call === 1) {
        throw new Error("boom");
      }
      return {
        discoverAuthStorage: () => ({}),
        discoverModels: () => [{ id: "gpt-4.1", name: "GPT-4.1", provider: "openai" }],
      } as unknown as PiSdkModule;
    });

    const cfg = {} as crocbotConfig;
    const first = await loadModelCatalog({ config: cfg });
    expect(first).toEqual([]);

    const second = await loadModelCatalog({ config: cfg });
    expect(second).toEqual([
      {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        provider: "anthropic",
        contextWindow: 200_000,
        reasoning: true,
        input: ["text", "image"],
      },
      { id: "gpt-4.1", name: "GPT-4.1", provider: "openai" },
    ]);
    expect(call).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("returns partial results on discovery errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    __setModelCatalogImportForTest(
      async () =>
        ({
          discoverAuthStorage: () => ({}),
          discoverModels: () => ({
            getAll: () => [
              { id: "gpt-4.1", name: "GPT-4.1", provider: "openai" },
              {
                get id() {
                  throw new Error("boom");
                },
                provider: "openai",
                name: "bad",
              },
            ],
          }),
        }) as unknown as PiSdkModule,
    );

    const result = await loadModelCatalog({ config: {} as crocbotConfig });
    // Error path skips supplemental model injection — only the successfully
    // parsed models are returned.
    expect(result).toEqual([{ id: "gpt-4.1", name: "GPT-4.1", provider: "openai" }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
