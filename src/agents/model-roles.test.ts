import { describe, expect, it } from "vitest";
import type { ModelRolesConfig } from "../config/types.model-roles.js";
import { normalizeRoleConfig, parseModelReference, resolveModelRole } from "./model-roles.js";

describe("parseModelReference", () => {
  it("parses valid provider/model reference", () => {
    const result = parseModelReference("anthropic/claude-haiku-3.5");
    expect(result).toEqual({ provider: "anthropic", modelId: "claude-haiku-3.5" });
  });

  it("splits on the first slash only (model id with slash)", () => {
    const result = parseModelReference("provider/model/variant");
    expect(result).toEqual({ provider: "provider", modelId: "model/variant" });
  });

  it("handles provider names with dots", () => {
    const result = parseModelReference("my.provider/model-v2");
    expect(result).toEqual({ provider: "my.provider", modelId: "model-v2" });
  });

  it("trims whitespace from input and parts", () => {
    const result = parseModelReference("  openai / gpt-4o  ");
    expect(result).toEqual({ provider: "openai", modelId: "gpt-4o" });
  });

  it("returns null for empty string", () => {
    expect(parseModelReference("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parseModelReference("   ")).toBeNull();
  });

  it("returns null for string without slash", () => {
    expect(parseModelReference("no-slash-here")).toBeNull();
  });

  it("returns null for leading slash (empty provider)", () => {
    expect(parseModelReference("/model")).toBeNull();
  });

  it("returns null for trailing slash (empty model)", () => {
    expect(parseModelReference("provider/")).toBeNull();
  });

  it("returns null for bare slash", () => {
    expect(parseModelReference("/")).toBeNull();
  });
});

describe("normalizeRoleConfig", () => {
  it("normalizes string input to canonical form", () => {
    const result = normalizeRoleConfig("openai/gpt-4o-mini");
    expect(result).toEqual({ model: "openai/gpt-4o-mini" });
  });

  it("trims whitespace from string input", () => {
    const result = normalizeRoleConfig("  anthropic/claude-haiku-3.5  ");
    expect(result).toEqual({ model: "anthropic/claude-haiku-3.5" });
  });

  it("normalizes object input preserving model and params", () => {
    const result = normalizeRoleConfig({
      model: "openai/gpt-4o-mini",
      params: { temperature: 0.1 },
    });
    expect(result).toEqual({
      model: "openai/gpt-4o-mini",
      params: { temperature: 0.1 },
    });
  });

  it("normalizes object input without params", () => {
    const result = normalizeRoleConfig({ model: "openai/gpt-4o-mini" });
    expect(result).toEqual({ model: "openai/gpt-4o-mini" });
  });

  it("strips empty params object", () => {
    const result = normalizeRoleConfig({ model: "openai/gpt-4o-mini", params: {} });
    expect(result).toEqual({ model: "openai/gpt-4o-mini" });
  });

  it("trims whitespace from object model field", () => {
    const result = normalizeRoleConfig({ model: "  openai/gpt-4o  " });
    expect(result).toEqual({ model: "openai/gpt-4o" });
  });

  it("returns null for undefined", () => {
    expect(normalizeRoleConfig(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeRoleConfig("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeRoleConfig("   ")).toBeNull();
  });

  it("returns null for object with empty model", () => {
    expect(normalizeRoleConfig({ model: "" })).toBeNull();
  });

  it("returns null for object with whitespace-only model", () => {
    expect(normalizeRoleConfig({ model: "   " })).toBeNull();
  });
});

describe("resolveModelRole", () => {
  const PRIMARY = "anthropic/claude-sonnet-4.5";

  describe("reasoning role", () => {
    it("resolves configured reasoning model (string)", () => {
      const config: ModelRolesConfig = { reasoning: "anthropic/claude-opus-4.6" };
      const result = resolveModelRole("reasoning", config, PRIMARY);
      expect(result).toEqual({
        provider: "anthropic",
        modelId: "claude-opus-4.6",
        model: "anthropic/claude-opus-4.6",
        isFallback: false,
      });
    });

    it("resolves configured reasoning model (object)", () => {
      const config: ModelRolesConfig = {
        reasoning: { model: "anthropic/claude-opus-4.6", params: { temperature: 0.7 } },
      };
      const result = resolveModelRole("reasoning", config, PRIMARY);
      expect(result).toEqual({
        provider: "anthropic",
        modelId: "claude-opus-4.6",
        model: "anthropic/claude-opus-4.6",
        isFallback: false,
        params: { temperature: 0.7 },
      });
    });

    it("falls back to primary when reasoning is not configured", () => {
      const config: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const result = resolveModelRole("reasoning", config, PRIMARY);
      expect(result).toEqual({
        provider: "anthropic",
        modelId: "claude-sonnet-4.5",
        model: PRIMARY,
        isFallback: true,
      });
    });
  });

  describe("utility role", () => {
    it("resolves configured utility model (string)", () => {
      const config: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result).toEqual({
        provider: "openai",
        modelId: "gpt-4o-mini",
        model: "openai/gpt-4o-mini",
        isFallback: false,
      });
    });

    it("resolves configured utility model (object with params)", () => {
      const config: ModelRolesConfig = {
        utility: { model: "openai/gpt-4o-mini", params: { temperature: 0.1, maxTokens: 500 } },
      };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result).toEqual({
        provider: "openai",
        modelId: "gpt-4o-mini",
        model: "openai/gpt-4o-mini",
        isFallback: false,
        params: { temperature: 0.1, maxTokens: 500 },
      });
    });

    it("falls back to primary when utility is not configured", () => {
      const config: ModelRolesConfig = { reasoning: "anthropic/claude-opus-4.6" };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result).toEqual({
        provider: "anthropic",
        modelId: "claude-sonnet-4.5",
        model: PRIMARY,
        isFallback: true,
      });
    });
  });

  describe("fallback behavior", () => {
    it("falls back when rolesConfig is undefined", () => {
      const result = resolveModelRole("utility", undefined, PRIMARY);
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4.5");
    });

    it("falls back when rolesConfig is empty object", () => {
      const result = resolveModelRole("utility", {}, PRIMARY);
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when role value is empty string", () => {
      const config: ModelRolesConfig = { utility: "" };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when role value has no slash (invalid ref)", () => {
      const config: ModelRolesConfig = { utility: "no-slash" };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when role object has empty model", () => {
      const config: ModelRolesConfig = { utility: { model: "" } };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when role ref has empty provider (leading slash)", () => {
      const config: ModelRolesConfig = { utility: "/model-only" };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when role ref has empty model (trailing slash)", () => {
      const config: ModelRolesConfig = { utility: "provider/" };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });
  });

  describe("full config scenarios", () => {
    it("resolves both roles from full config", () => {
      const config: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4.6",
        utility: "openai/gpt-4o-mini",
      };
      const reasoning = resolveModelRole("reasoning", config, PRIMARY);
      const utility = resolveModelRole("utility", config, PRIMARY);

      expect(reasoning.provider).toBe("anthropic");
      expect(reasoning.modelId).toBe("claude-opus-4.6");
      expect(reasoning.isFallback).toBe(false);

      expect(utility.provider).toBe("openai");
      expect(utility.modelId).toBe("gpt-4o-mini");
      expect(utility.isFallback).toBe(false);
    });

    it("handles utility-only config (reasoning falls back)", () => {
      const config: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const reasoning = resolveModelRole("reasoning", config, PRIMARY);
      const utility = resolveModelRole("utility", config, PRIMARY);

      expect(reasoning.isFallback).toBe(true);
      expect(reasoning.model).toBe(PRIMARY);
      expect(utility.isFallback).toBe(false);
      expect(utility.model).toBe("openai/gpt-4o-mini");
    });

    it("preserves params from object config through resolution", () => {
      const config: ModelRolesConfig = {
        utility: { model: "openai/gpt-4o-mini", params: { temperature: 0 } },
      };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result.params).toEqual({ temperature: 0 });
    });

    it("does not include params when absent", () => {
      const config: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const result = resolveModelRole("utility", config, PRIMARY);
      expect(result.params).toBeUndefined();
    });
  });
});
