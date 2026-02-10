import { describe, expect, it } from "vitest";
import type { ModelRolesConfig } from "../config/types.model-roles.js";
import { createModelRouter } from "./model-router.js";

const PRIMARY = "anthropic/claude-sonnet-4.5";

describe("createModelRouter", () => {
  describe("resolve() with utility configured", () => {
    const config: ModelRolesConfig = {
      reasoning: "anthropic/claude-opus-4.6",
      utility: "openai/gpt-4o-mini",
    };
    const router = createModelRouter(config, PRIMARY);

    it("resolves reasoning task to configured reasoning model", () => {
      const result = router.resolve({ taskType: "reasoning" });
      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-opus-4.6");
      expect(result.model).toBe("anthropic/claude-opus-4.6");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("reasoning");
      expect(result.label).toBe("agent-turn");
    });

    it("resolves compaction task to utility model", () => {
      const result = router.resolve({ taskType: "compaction" });
      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.model).toBe("openai/gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("compaction");
      expect(result.label).toBe("compaction");
    });

    it("resolves memory-flush task to utility model", () => {
      const result = router.resolve({ taskType: "memory-flush" });
      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("memory-flush");
      expect(result.label).toBe("memory-flush");
    });

    it("resolves heartbeat task to utility model", () => {
      const result = router.resolve({ taskType: "heartbeat" });
      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("heartbeat");
      expect(result.label).toBe("heartbeat");
    });

    it("resolves llm-task to utility model", () => {
      const result = router.resolve({ taskType: "llm-task" });
      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("llm-task");
      expect(result.label).toBe("llm-task");
    });
  });

  describe("resolve() fallback behavior", () => {
    it("falls back to primary when utility is not configured", () => {
      const config: ModelRolesConfig = { reasoning: "anthropic/claude-opus-4.6" };
      const router = createModelRouter(config, PRIMARY);

      const result = router.resolve({ taskType: "compaction" });
      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4.5");
      expect(result.model).toBe(PRIMARY);
      expect(result.isFallback).toBe(true);
      expect(result.taskType).toBe("compaction");
      expect(result.label).toBe("compaction");
    });

    it("falls back to primary when rolesConfig is undefined", () => {
      const router = createModelRouter(undefined, PRIMARY);

      const result = router.resolve({ taskType: "heartbeat" });
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
      expect(result.taskType).toBe("heartbeat");
    });

    it("falls back to primary when rolesConfig is empty object", () => {
      const router = createModelRouter({}, PRIMARY);

      const result = router.resolve({ taskType: "compaction" });
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when utility model reference is invalid (no slash)", () => {
      const config: ModelRolesConfig = { utility: "no-slash" };
      const router = createModelRouter(config, PRIMARY);

      const result = router.resolve({ taskType: "compaction" });
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when utility model reference is empty string", () => {
      const config: ModelRolesConfig = { utility: "" };
      const router = createModelRouter(config, PRIMARY);

      const result = router.resolve({ taskType: "memory-flush" });
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when utility model reference has empty provider", () => {
      const config: ModelRolesConfig = { utility: "/model-only" };
      const router = createModelRouter(config, PRIMARY);

      const result = router.resolve({ taskType: "heartbeat" });
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });

    it("falls back when utility model reference has empty model", () => {
      const config: ModelRolesConfig = { utility: "provider/" };
      const router = createModelRouter(config, PRIMARY);

      const result = router.resolve({ taskType: "llm-task" });
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY);
    });
  });

  describe("resolve() consistency", () => {
    it("returns consistent results for repeated calls", () => {
      const config: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const router = createModelRouter(config, PRIMARY);

      const a = router.resolve({ taskType: "compaction" });
      const b = router.resolve({ taskType: "compaction" });
      expect(a).toEqual(b);
    });

    it("preserves params from object config", () => {
      const config: ModelRolesConfig = {
        utility: { model: "openai/gpt-4o-mini", params: { temperature: 0.1 } },
      };
      const router = createModelRouter(config, PRIMARY);

      const result = router.resolve({ taskType: "compaction" });
      expect(result.params).toEqual({ temperature: 0.1 });
    });
  });

  describe("hasRole()", () => {
    it("returns true for configured utility role", () => {
      const config: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const router = createModelRouter(config, PRIMARY);

      expect(router.hasRole("utility")).toBe(true);
    });

    it("returns false for unconfigured utility role", () => {
      const config: ModelRolesConfig = { reasoning: "anthropic/claude-opus-4.6" };
      const router = createModelRouter(config, PRIMARY);

      expect(router.hasRole("utility")).toBe(false);
    });

    it("returns true for configured reasoning role", () => {
      const config: ModelRolesConfig = { reasoning: "anthropic/claude-opus-4.6" };
      const router = createModelRouter(config, PRIMARY);

      expect(router.hasRole("reasoning")).toBe(true);
    });

    it("returns false for unconfigured reasoning role (falls back to primary)", () => {
      const config: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const router = createModelRouter(config, PRIMARY);

      expect(router.hasRole("reasoning")).toBe(false);
    });

    it("returns false for both roles when rolesConfig is undefined", () => {
      const router = createModelRouter(undefined, PRIMARY);

      expect(router.hasRole("utility")).toBe(false);
      expect(router.hasRole("reasoning")).toBe(false);
    });

    it("returns false for both roles when rolesConfig is empty", () => {
      const router = createModelRouter({}, PRIMARY);

      expect(router.hasRole("utility")).toBe(false);
      expect(router.hasRole("reasoning")).toBe(false);
    });

    it("returns false when utility model reference is invalid", () => {
      const config: ModelRolesConfig = { utility: "no-slash" };
      const router = createModelRouter(config, PRIMARY);

      expect(router.hasRole("utility")).toBe(false);
    });
  });

  describe("full config scenarios", () => {
    it("routes all utility tasks to utility model when configured", () => {
      const config: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4.6",
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(config, PRIMARY);

      const utilityTasks = ["compaction", "memory-flush", "heartbeat", "llm-task"] as const;
      for (const taskType of utilityTasks) {
        const result = router.resolve({ taskType });
        expect(result.provider).toBe("openai");
        expect(result.modelId).toBe("gpt-4o-mini");
        expect(result.isFallback).toBe(false);
      }
    });

    it("reasoning task always uses reasoning model even with utility configured", () => {
      const config: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4.6",
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(config, PRIMARY);

      const result = router.resolve({ taskType: "reasoning" });
      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-opus-4.6");
    });

    it("utility-only config: reasoning falls back to primary", () => {
      const config: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const router = createModelRouter(config, PRIMARY);

      const reasoning = router.resolve({ taskType: "reasoning" });
      const compaction = router.resolve({ taskType: "compaction" });

      expect(reasoning.isFallback).toBe(true);
      expect(reasoning.model).toBe(PRIMARY);
      expect(compaction.isFallback).toBe(false);
      expect(compaction.model).toBe("openai/gpt-4o-mini");
    });
  });
});
