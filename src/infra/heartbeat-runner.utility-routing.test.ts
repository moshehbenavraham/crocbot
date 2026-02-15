import { describe, expect, it } from "vitest";
import type { ModelRolesConfig } from "../config/types.model-roles.js";
import { createModelRouter } from "../agents/model-router.js";

/**
 * Tests for the heartbeat utility model routing logic.
 *
 * Heartbeat model resolution follows a three-tier precedence:
 *   1. heartbeat.model (explicit override)  -- checked first in get-reply.ts
 *   2. roles.utility  (via model router)    -- used when no explicit override
 *   3. reasoning model (primary fallback)   -- when utility is absent/invalid
 *
 * These tests verify the router resolution for heartbeat tasks and the
 * precedence pattern used in get-reply.ts without mocking the full
 * getReplyFromConfig flow.
 */

const PRIMARY_MODEL = "anthropic/claude-sonnet-4-5";

// ---------------------------------------------------------------------------
// Router resolution for heartbeat tasks
// ---------------------------------------------------------------------------

describe("heartbeat utility model routing", () => {
  describe("router resolves heartbeat to utility model when configured", () => {
    it("uses the utility model when roles.utility is set", () => {
      const roles: ModelRolesConfig = {
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.model).toBe("openai/gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("heartbeat");
      expect(result.label).toBe("heartbeat");
    });

    it("uses the utility model when both reasoning and utility are configured", () => {
      const roles: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4-6",
        utility: "google/gemini-2.0-flash",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.provider).toBe("google");
      expect(result.modelId).toBe("gemini-2.0-flash");
      expect(result.isFallback).toBe(false);
    });
  });

  describe("router falls back to reasoning model when utility is absent", () => {
    it("falls back when roles config is undefined", () => {
      const router = createModelRouter(undefined, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4-5");
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
      expect(result.taskType).toBe("heartbeat");
    });

    it("falls back when roles config is an empty object", () => {
      const router = createModelRouter({}, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back when only reasoning role is configured", () => {
      const roles: ModelRolesConfig = {
        reasoning: "anthropic/claude-opus-4-6",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.taskType).toBe("heartbeat");
    });
  });

  describe("router falls back when utility model string is invalid", () => {
    it("falls back when utility has no slash separator", () => {
      const roles: ModelRolesConfig = { utility: "gpt-4o-mini" };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back when utility is an empty string", () => {
      const roles: ModelRolesConfig = { utility: "" };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back when utility has empty provider segment", () => {
      const roles: ModelRolesConfig = { utility: "/gpt-4o-mini" };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back when utility has empty model segment", () => {
      const roles: ModelRolesConfig = { utility: "openai/" };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });
  });

  // -------------------------------------------------------------------------
  // Precedence: heartbeat.model > roles.utility > reasoning (default)
  //
  // This mirrors the decision structure in get-reply.ts:
  //   if (heartbeatRef) { ... use explicit model ... }
  //   else { ... use router.resolve({ taskType: "heartbeat" }) ... }
  // -------------------------------------------------------------------------

  describe("heartbeat.model takes precedence over roles.utility", () => {
    it("explicit heartbeatRef wins even when utility is configured", () => {
      // Simulate the same logic pattern as get-reply.ts:
      // 1. heartbeatRef is resolved from heartbeat.model
      // 2. If heartbeatRef is truthy, it is used (explicit override)
      // 3. Otherwise, the router resolves the heartbeat task

      const heartbeatRef = { provider: "anthropic", model: "claude-haiku-3" };

      const roles: ModelRolesConfig = {
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      // The precedence pattern from get-reply.ts
      let resolvedProvider: string;
      let resolvedModel: string;

      if (heartbeatRef) {
        resolvedProvider = heartbeatRef.provider;
        resolvedModel = heartbeatRef.model;
      } else {
        const routerResult = router.resolve({ taskType: "heartbeat" });
        resolvedProvider = routerResult.provider;
        resolvedModel = routerResult.modelId;
      }

      // Explicit heartbeat.model wins
      expect(resolvedProvider).toBe("anthropic");
      expect(resolvedModel).toBe("claude-haiku-3");
    });

    it("router utility is used when heartbeatRef is null", () => {
      // heartbeat.model was empty or unset, so heartbeatRef is null
      const heartbeatRef = null;

      const roles: ModelRolesConfig = {
        utility: "openai/gpt-4o-mini",
      };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      let resolvedProvider: string;
      let resolvedModel: string;

      if (heartbeatRef) {
        resolvedProvider = heartbeatRef.provider;
        resolvedModel = heartbeatRef.model;
      } else {
        const routerResult = router.resolve({ taskType: "heartbeat" });
        resolvedProvider = routerResult.provider;
        resolvedModel = routerResult.modelId;
      }

      // Falls through to utility via router
      expect(resolvedProvider).toBe("openai");
      expect(resolvedModel).toBe("gpt-4o-mini");
    });

    it("falls all the way to reasoning when heartbeatRef is null and utility is absent", () => {
      const heartbeatRef = null;

      // No utility configured
      const router = createModelRouter(undefined, PRIMARY_MODEL);

      let resolvedProvider: string;
      let resolvedModel: string;

      if (heartbeatRef) {
        resolvedProvider = heartbeatRef.provider;
        resolvedModel = heartbeatRef.model;
      } else {
        const routerResult = router.resolve({ taskType: "heartbeat" });
        resolvedProvider = routerResult.provider;
        resolvedModel = routerResult.modelId;
      }

      // Falls back to the primary reasoning model
      expect(resolvedProvider).toBe("anthropic");
      expect(resolvedModel).toBe("claude-sonnet-4-5");
    });
  });

  // -------------------------------------------------------------------------
  // hasRole check confirms utility availability for heartbeat routing
  // -------------------------------------------------------------------------

  describe("hasRole reflects utility availability for heartbeat decisions", () => {
    it("hasRole('utility') is true when utility is configured", () => {
      const roles: ModelRolesConfig = { utility: "openai/gpt-4o-mini" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      expect(router.hasRole("utility")).toBe(true);
    });

    it("hasRole('utility') is false when utility is missing", () => {
      const router = createModelRouter({}, PRIMARY_MODEL);

      expect(router.hasRole("utility")).toBe(false);
    });

    it("hasRole('utility') is false when utility model string is invalid", () => {
      const roles: ModelRolesConfig = { utility: "no-slash-invalid" };
      const router = createModelRouter(roles, PRIMARY_MODEL);

      expect(router.hasRole("utility")).toBe(false);
    });
  });
});
