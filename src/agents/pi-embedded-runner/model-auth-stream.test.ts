import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { discoverAuthStorage, discoverModels } from "../pi-model-discovery.js";
import { createModelAuthStreamFn } from "./model-auth-stream.js";

type Seen = http.IncomingHttpHeaders;

const zeroCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

describe("createModelAuthStreamFn (outgoing request headers)", () => {
  const seen: Seen[] = [];
  let server: http.Server;
  let baseUrl = "";
  let tmpDirs: string[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seen.push(req.headers);
      req.resume();
      res.writeHead(500, { "content-type": "application/json" });
      res.end("{}");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
  });

  beforeEach(() => {
    seen.length = 0;
  });

  function setup(providers: Record<string, unknown>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crocbot-model-auth-stream-"));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, "models.json"), JSON.stringify({ providers }));
    const authStorage = discoverAuthStorage(dir);
    const registry = discoverModels(authStorage, dir);
    return { authStorage, registry };
  }

  async function send(
    registry: ReturnType<typeof discoverModels>,
    provider: string,
    options?: { headers?: Record<string, string> },
  ): Promise<Seen> {
    const model = registry.find(provider, "m1");
    expect(model).toBeTruthy();
    const streamFn = createModelAuthStreamFn(registry);
    const stream = await streamFn(
      model!,
      { systemPrompt: "", messages: [{ role: "user", content: "hi", timestamp: Date.now() }] },
      { maxRetries: 0, ...options },
    );
    for await (const _event of stream) {
      // drain until the mock server's 500 ends the stream
    }
    expect(seen).toHaveLength(1);
    return seen[0];
  }

  it("sends kimi-code style model User-Agent, provider headers and authHeader bearer", async () => {
    const { registry } = setup({
      "kimi-test": {
        baseUrl: `${baseUrl}/v1`,
        api: "openai-completions",
        apiKey: "test-key-kimi",
        authHeader: true,
        headers: { "X-Prov": "p" },
        models: [
          {
            id: "m1",
            name: "m1",
            reasoning: false,
            input: ["text"],
            cost: zeroCost,
            contextWindow: 1000,
            maxTokens: 100,
            headers: { "User-Agent": "KimiCLI/0.77" },
          },
        ],
      },
    });
    const headers = await send(registry, "kimi-test");
    expect(headers["user-agent"]).toBe("KimiCLI/0.77");
    expect(headers["x-prov"]).toBe("p");
    expect(headers.authorization).toBe("Bearer test-key-kimi");
  });

  it("adds an Authorization bearer for authHeader on a non-OpenAI API, with custom headers", async () => {
    const { registry } = setup({
      "anthropic-proxy": {
        baseUrl,
        api: "anthropic-messages",
        apiKey: "test-key-anthropic",
        authHeader: true,
        headers: { "X-Custom": "c1" },
        models: [
          {
            id: "m1",
            name: "m1",
            reasoning: false,
            input: ["text"],
            cost: zeroCost,
            contextWindow: 1000,
            maxTokens: 100,
          },
        ],
      },
    });
    const headers = await send(registry, "anthropic-proxy");
    expect(headers["x-custom"]).toBe("c1");
    expect(headers.authorization).toBe("Bearer test-key-anthropic");
  });

  it("lets the per-attempt runtime key win and outer option headers override", async () => {
    const { authStorage, registry } = setup({
      "custom-openai": {
        baseUrl: `${baseUrl}/v1`,
        api: "openai-completions",
        apiKey: "test-key-config",
        headers: { "X-Prov": "from-config", "X-Keep": "k" },
        models: [
          {
            id: "m1",
            name: "m1",
            reasoning: false,
            input: ["text"],
            cost: zeroCost,
            contextWindow: 1000,
            maxTokens: 100,
          },
        ],
      },
    });
    authStorage.setRuntimeApiKey("custom-openai", "test-key-runtime");
    const headers = await send(registry, "custom-openai", {
      headers: { "X-Prov": "from-options" },
    });
    expect(headers.authorization).toBe("Bearer test-key-runtime");
    expect(headers["x-prov"]).toBe("from-options");
    expect(headers["x-keep"]).toBe("k");
  });

  it("throws the registry error (like pi's default streamFn) instead of sending", async () => {
    const { registry } = setup({});
    const model = { provider: "x", id: "m1", api: "openai-completions" } as Parameters<
      ReturnType<typeof createModelAuthStreamFn>
    >[0];
    const failing = {
      getApiKeyAndHeaders: async () => ({ ok: false as const, error: 'No API key found for "x"' }),
    } as unknown as typeof registry;
    const streamFn = createModelAuthStreamFn(failing);
    await expect(
      Promise.resolve(streamFn(model, { systemPrompt: "", messages: [] }, { maxRetries: 0 })),
    ).rejects.toThrow('No API key found for "x"');
    expect(seen).toHaveLength(0);
  });
});
