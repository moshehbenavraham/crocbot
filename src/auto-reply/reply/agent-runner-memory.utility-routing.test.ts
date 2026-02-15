import { describe, expect, it } from "vitest";
import { createModelRouter } from "../../agents/model-router.js";
import type { ModelRolesConfig } from "../../config/types.model-roles.js";

/**
 * Tests for model routing as used by the memory flush call site
 * (agent-runner-memory.ts). Verifies that `createModelRouter` resolves
 * `taskType: "memory-flush"` to the correct provider/model pair based
 * on the roles configuration.
 */

const PRIMARY_MODEL = "anthropic/claude-sonnet-4.5";

describe("agent-runner-memory utility routing", () => {
  describe("memory-flush resolves to utility model when roles.utility is configured", () => {
    it("uses the configured utility provider and modelId", () => {
      const roles: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.model).toBe("openai/gpt-4o-mini");
    });

    it("marks the resolution as non-fallback", () => {
      const roles: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.isFallback).toBe(false);
    });

    it("classifies the task type as memory-flush", () => {
      const roles: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.taskType).toBe("memory-flush");
      expect(result.label).toBe("memory-flush");
    });

    it("works with a different utility provider", () => {
      const roles: ModelRolesConfig = { utility: "google/gemini-2.0-flash" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.provider).toBe("google");
      expect(result.modelId).toBe("gemini-2.0-flash");
      expect(result.isFallback).toBe(false);
    });

    it("works when both reasoning and utility are configured", () => {
      const roles: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4.6",
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
    });

    it("preserves params from object-form utility config", () => {
      const roles: ModelRolesConfig = {
        utility: { model: "openai/gpt-4o-mini", params: { temperature: 0 } },
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.params).toEqual({ temperature: 0 });
    });
  });

  describe("memory-flush falls back to reasoning model when roles.utility is absent", () => {
    it("falls back when rolesConfig has no utility field", () => {
      const roles: ModelRolesConfig = { reasoning: "anthropic/claude-opus-4.6" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4.5");
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
    });

    it("falls back when rolesConfig is undefined", () => {
      const router = createModelRouter(undefined, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4.5");
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
    });

    it("falls back when rolesConfig is an empty object", () => {
      const router = createModelRouter({}, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back when utility is an empty string", () => {
      const roles: ModelRolesConfig = { utility: "" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("still classifies the task type correctly on fallback", () => {
      const router = createModelRouter(undefined, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.taskType).toBe("memory-flush");
      expect(result.label).toBe("memory-flush");
    });
  });

  describe("memory-flush falls back when roles.utility has an invalid model string", () => {
    it("falls back when utility has no slash separator", () => {
      const roles: ModelRolesConfig = { utility: "not-a-valid-model" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4.5");
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
    });

    it("falls back when utility has an empty provider (leading slash)", () => {
      const roles: ModelRolesConfig = { utility: "/gpt-4o-mini" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back when utility has an empty model (trailing slash)", () => {
      const roles: ModelRolesConfig = { utility: "openai/" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back when utility is whitespace only", () => {
      const roles: ModelRolesConfig = { utility: "   " };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back to primary even when reasoning is configured alongside invalid utility", () => {
      const roles: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4.6",
        utility: "not-a-valid-model",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4.5");
    });
  });
});
