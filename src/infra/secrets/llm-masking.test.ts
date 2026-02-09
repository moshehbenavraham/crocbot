import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StreamFn } from "@mariozechner/pi-agent-core";

import { makePlaceholder } from "./masker.js";
import { SecretsRegistry } from "./registry.js";
import { wrapStreamFnWithMasking } from "./llm-masking.js";

describe("wrapStreamFnWithMasking", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  function createMockStreamFn(): StreamFn & { calls: Array<{ context: unknown }> } {
    const calls: Array<{ context: unknown }> = [];
    const fn = ((_model: unknown, context: unknown, _options?: unknown) => {
      calls.push({ context });
      return undefined as never;
    }) as StreamFn & { calls: Array<{ context: unknown }> };
    fn.calls = calls;
    return fn;
  }

  // -------------------------------------------------------------------------
  // Context masking
  // -------------------------------------------------------------------------

  describe("context masking", () => {
    it("masks system prompt containing a secret", () => {
      const secret = "sk-test-abc123XYZ";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("api-key", secret);
      const placeholder = makePlaceholder(secret);

      const inner = createMockStreamFn();
      const wrapped = wrapStreamFnWithMasking(inner);

      const context = {
        systemPrompt: `You have access to API key ${secret}`,
        messages: [],
      };
      void wrapped(null as never, context as never);

      expect(inner.calls).toHaveLength(1);
      const maskedContext = inner.calls[0].context as typeof context;
      expect(maskedContext.systemPrompt).toBe(`You have access to API key ${placeholder}`);
      expect(maskedContext.systemPrompt).not.toContain(secret);
    });

    it("masks user messages containing secrets", () => {
      const secret = "ghp_abcdefgh12345678";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("token", secret);
      const placeholder = makePlaceholder(secret);

      const inner = createMockStreamFn();
      const wrapped = wrapStreamFnWithMasking(inner);

      const context = {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: `Use token ${secret} for auth` }],
          },
        ],
      };
      void wrapped(null as never, context as never);

      expect(inner.calls).toHaveLength(1);
      const maskedCtx = inner.calls[0].context as typeof context;
      const textBlock = maskedCtx.messages[0].content[0] as { text: string };
      expect(textBlock.text).toBe(`Use token ${placeholder} for auth`);
      expect(textBlock.text).not.toContain(secret);
    });

    it("masks tool results in context", () => {
      const secret = "database-password-xyz123";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("db-pass", secret);
      const placeholder = makePlaceholder(secret);

      const inner = createMockStreamFn();
      const wrapped = wrapStreamFnWithMasking(inner);

      const context = {
        messages: [
          {
            role: "tool",
            content: [{ type: "text", text: `Config loaded: password=${secret}` }],
          },
        ],
      };
      void wrapped(null as never, context as never);

      const maskedCtx = inner.calls[0].context as typeof context;
      const textBlock = maskedCtx.messages[0].content[0] as { text: string };
      expect(textBlock.text).toBe(`Config loaded: password=${placeholder}`);
    });
  });

  // -------------------------------------------------------------------------
  // No-op behavior
  // -------------------------------------------------------------------------

  describe("no-op", () => {
    it("passes context through unchanged when registry is empty", () => {
      SecretsRegistry.getInstance();
      const inner = createMockStreamFn();
      const wrapped = wrapStreamFnWithMasking(inner);

      const context = {
        systemPrompt: "Hello world",
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      void wrapped(null as never, context as never);

      expect(inner.calls).toHaveLength(1);
      // Same object reference when no masking needed
      expect(inner.calls[0].context).toBe(context);
    });
  });

  // -------------------------------------------------------------------------
  // Provider-agnostic
  // -------------------------------------------------------------------------

  describe("provider-agnostic", () => {
    it("masks regardless of model type", () => {
      const secret = "xoxb-slack-token-12345";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("slack", secret);
      const placeholder = makePlaceholder(secret);

      const inner = createMockStreamFn();
      const wrapped = wrapStreamFnWithMasking(inner);

      const context = {
        systemPrompt: `Slack token: ${secret}`,
        messages: [],
      };

      // Test with different model types
      const models = [
        { id: "claude-3", provider: "anthropic", api: "anthropic-messages" },
        { id: "gpt-4", provider: "openai", api: "openai-responses" },
        { id: "gemini-pro", provider: "google", api: "google-generative-ai" },
      ];

      for (const model of models) {
        inner.calls.length = 0;
        void wrapped(model as never, context as never);
        const maskedCtx = inner.calls[0].context as typeof context;
        expect(maskedCtx.systemPrompt).toBe(`Slack token: ${placeholder}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Passthrough
  // -------------------------------------------------------------------------

  describe("passthrough", () => {
    it("preserves model and options when delegating", () => {
      const secret = "test-secret-value";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", secret);

      const inner = vi.fn((() => undefined) as unknown as StreamFn);
      const wrapped = wrapStreamFnWithMasking(inner);

      const model = { id: "test-model" };
      const context = { messages: [] };
      const options = { timeout: 5000 };

      void wrapped(model as never, context as never, options as never);

      expect(inner).toHaveBeenCalledOnce();
      // Model should pass through unchanged
      expect(inner.mock.calls[0][0]).toBe(model);
      // Options should pass through unchanged
      expect(inner.mock.calls[0][2]).toBe(options);
    });
  });
});
