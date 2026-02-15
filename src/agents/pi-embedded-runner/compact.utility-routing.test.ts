import { describe, expect, it } from "vitest";
import type { ModelRolesConfig } from "../../config/types.model-roles.js";
import { createModelRouter } from "../model-router.js";

/**
 * Tests that the model router correctly resolves the compaction task type
 * to the utility model when configured, and falls back to the primary
 * (reasoning) model when the utility role is absent or invalid.
 *
 * This validates the routing logic consumed by compact.ts without
 * exercising the full PI SDK compaction flow.
 */

const PRIMARY_MODEL = "anthropic/claude-sonnet-4.5";

describe("compaction utility-model routing", () => {
  describe("when roles.utility is configured", () => {
    it("resolves compaction to the utility model", () => {
      const roles: ModelRolesConfig = {
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.model).toBe("openai/gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("compaction");
    });

    it("returns the correct label for compaction tasks", () => {
      const roles: ModelRolesConfig = {
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.label).toBe("compaction");
    });

    it("uses the utility model even when reasoning is also configured", () => {
      const roles: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4.6",
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
    });

    it("supports object-form utility config with params", () => {
      const roles: ModelRolesConfig = {
        utility: {
          model: "google/gemini-2.0-flash",
          params: { temperature: 0.2 },
        },
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("google");
      expect(result.modelId).toBe("gemini-2.0-flash");
      expect(result.isFallback).toBe(false);
      expect(result.params).toEqual({ temperature: 0.2 });
    });
  });

  describe("when roles.utility is absent", () => {
    it("falls back to the primary model when only reasoning is configured", () => {
      const roles: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4.6",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4.5");
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
      expect(result.taskType).toBe("compaction");
    });

    it("falls back to the primary model when rolesConfig is undefined", () => {
      const router = createModelRouter(undefined, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
      expect(result.taskType).toBe("compaction");
    });

    it("falls back to the primary model when rolesConfig is an empty object", () => {
      const router = createModelRouter({}, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
      expect(result.taskType).toBe("compaction");
    });
  });

  describe("when roles.utility has an invalid model string", () => {
    it("falls back to the primary model when utility has no slash separator", () => {
      const roles: ModelRolesConfig = {
        utility: "invalid-model-string",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
      expect(result.taskType).toBe("compaction");
    });

    it("falls back to the primary model when utility is an empty string", () => {
      const roles: ModelRolesConfig = {
        utility: "",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
    });

    it("falls back to the primary model when utility has empty provider", () => {
      const roles: ModelRolesConfig = {
        utility: "/gpt-4o-mini",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
    });

    it("falls back to the primary model when utility has empty model id", () => {
      const roles: ModelRolesConfig = {
        utility: "openai/",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
    });
  });
});
