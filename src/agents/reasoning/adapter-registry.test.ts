import { describe, expect, it } from "vitest";

import { getAdapters, resolveAdapter } from "./adapter-registry.js";

describe("adapter-registry", () => {
  describe("getAdapters", () => {
    it("returns all four adapters in priority order", () => {
      const adapters = getAdapters();
      expect(adapters).toHaveLength(4);
      expect(adapters[0].id).toBe("openai");
      expect(adapters[1].id).toBe("anthropic");
      expect(adapters[2].id).toBe("deepseek");
      expect(adapters[3].id).toBe("tag-fallback");
    });

    it("returns a readonly array", () => {
      const adapters = getAdapters();
      // Same reference each time
      expect(getAdapters()).toBe(adapters);
    });
  });

  describe("resolveAdapter", () => {
    it("resolves OpenAI adapter for o1 models", () => {
      const adapter = resolveAdapter({ model: "o1-preview", provider: "openai" });
      expect(adapter.id).toBe("openai");
    });

    it("resolves OpenAI adapter for o3 models", () => {
      const adapter = resolveAdapter({ model: "o3-mini", provider: "openai" });
      expect(adapter.id).toBe("openai");
    });

    it("resolves OpenAI adapter for o4 models", () => {
      const adapter = resolveAdapter({ model: "o4-mini", provider: "openai" });
      expect(adapter.id).toBe("openai");
    });

    it("resolves Anthropic adapter for anthropic provider", () => {
      const adapter = resolveAdapter({ model: "claude-3-opus", provider: "anthropic" });
      expect(adapter.id).toBe("anthropic");
    });

    it("resolves Anthropic adapter for any model with anthropic provider", () => {
      const adapter = resolveAdapter({ model: "unknown-model", provider: "anthropic" });
      expect(adapter.id).toBe("anthropic");
    });

    it("resolves DeepSeek adapter for deepseek-reasoner", () => {
      const adapter = resolveAdapter({ model: "deepseek-reasoner", provider: "deepseek" });
      expect(adapter.id).toBe("deepseek");
    });

    it("resolves DeepSeek adapter for deepseek-r1", () => {
      const adapter = resolveAdapter({ model: "deepseek-r1", provider: "deepseek" });
      expect(adapter.id).toBe("deepseek");
    });

    it("resolves DeepSeek adapter for r1 model via openrouter", () => {
      const adapter = resolveAdapter({ model: "deepseek-r1-lite", provider: "openrouter" });
      expect(adapter.id).toBe("deepseek");
    });

    it("falls back to tag-fallback for non-reasoning openai models", () => {
      const adapter = resolveAdapter({ model: "gpt-4o", provider: "openai" });
      expect(adapter.id).toBe("tag-fallback");
    });

    it("falls back to tag-fallback for unknown provider", () => {
      const adapter = resolveAdapter({ model: "some-model", provider: "unknown-provider" });
      expect(adapter.id).toBe("tag-fallback");
    });

    it("falls back to tag-fallback for empty model and provider", () => {
      const adapter = resolveAdapter({ model: "", provider: "" });
      expect(adapter.id).toBe("tag-fallback");
    });

    it("prioritizes OpenAI over DeepSeek for models matching both", () => {
      // A hypothetical model that starts with "o1" but provider is not openai
      // OpenAI requires provider === "openai", so this goes to DeepSeek or fallback
      const adapter = resolveAdapter({ model: "o1-reasoner", provider: "openai" });
      // OpenAI matches first (starts with "o1" + provider "openai")
      expect(adapter.id).toBe("openai");
    });

    it("prioritizes Anthropic over tag-fallback for anthropic provider", () => {
      const adapter = resolveAdapter({ model: "claude-3.5-sonnet", provider: "anthropic" });
      expect(adapter.id).toBe("anthropic");
    });

    it("prioritizes DeepSeek over tag-fallback for reasoner models", () => {
      const adapter = resolveAdapter({ model: "deepseek-reasoner", provider: "custom" });
      expect(adapter.id).toBe("deepseek");
    });
  });
});
