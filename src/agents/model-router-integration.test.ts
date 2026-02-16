/**
 * Integration tests for the composed model routing pipeline.
 *
 * Exercises the full 3-layer stack:
 *   Config (ModelRolesConfig) -> Classification (classifyTask) -> Routing (createModelRouter)
 *
 * Also validates integration with the rate limiter middleware's `role` parameter
 * for per-role usage tracking, and zero-config backward compatibility.
 *
 * @see docs/adr/0006-4-model-role-architecture.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelRolesConfig } from "../config/types.model-roles.js";
import type { ModelRole } from "../config/types.model-roles.js";
import { createModelRouter } from "./model-router.js";
import type { ModelRouter } from "./model-router.js";
import { classifyTask, TASK_TYPES } from "./task-classifier.js";
import type { TaskType } from "./task-classifier.js";
import { resolveModelRole, normalizeRoleConfig, parseModelReference } from "./model-roles.js";
import { withRateLimitCheck } from "../infra/rate-limit-middleware.js";
import { createProviderRateLimiter } from "../infra/provider-rate-limiter.js";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const PRIMARY_MODEL = "anthropic/claude-sonnet-4-5";
const UTILITY_MODEL_STRING = "openai/gpt-4o-mini";
const UTILITY_MODEL_GOOGLE = "google/gemini-2.0-flash";

const WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Create a ModelRolesConfig for common test scenarios. */
function createTestConfig(
  scenario:
    | "zero-config"
    | "string-utility"
    | "object-utility"
    | "empty-roles"
    | "partial-utility"
    | "both-roles"
    | "invalid-utility"
    | "whitespace-utility"
    | "google-utility",
): ModelRolesConfig | undefined {
  switch (scenario) {
    case "zero-config":
      return undefined;
    case "string-utility":
      return { utility: UTILITY_MODEL_STRING };
    case "object-utility":
      return {
        utility: { model: UTILITY_MODEL_STRING, params: { temperature: 0.1 } },
      };
    case "empty-roles":
      return {};
    case "partial-utility":
      return { utility: UTILITY_MODEL_STRING };
    case "both-roles":
      return {
        reasoning: "anthropic/claude-opus-4-6",
        utility: UTILITY_MODEL_STRING,
      };
    case "invalid-utility":
      return { utility: "invalid-no-slash" };
    case "whitespace-utility":
      return { utility: " openai / gpt-4o-mini " };
    case "google-utility":
      return { utility: UTILITY_MODEL_GOOGLE };
  }
}

/** Create a ModelRouter from a test config scenario. */
function createTestRouter(
  scenario: Parameters<typeof createTestConfig>[0],
  primaryModel?: string,
): ModelRouter {
  return createModelRouter(createTestConfig(scenario), primaryModel ?? PRIMARY_MODEL);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("model-router-integration", () => {
  // =========================================================================
  // Config-to-route pipeline (T008)
  // =========================================================================

  describe("config-to-route pipeline", () => {
    it("routes reasoning task to primary model when utility is configured", () => {
      const router = createTestRouter("string-utility");
      const result = router.resolve({ taskType: "reasoning" });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4-5");
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
      expect(result.taskType).toBe("reasoning");
      expect(result.label).toBe("agent-turn");
    });

    it("routes compaction task to utility model", () => {
      const router = createTestRouter("string-utility");
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.model).toBe(UTILITY_MODEL_STRING);
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("compaction");
      expect(result.label).toBe("compaction");
    });

    it("routes memory-flush task to utility model", () => {
      const router = createTestRouter("string-utility");
      const result = router.resolve({ taskType: "memory-flush" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("memory-flush");
      expect(result.label).toBe("memory-flush");
    });

    it("routes heartbeat task to utility model", () => {
      const router = createTestRouter("string-utility");
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("heartbeat");
      expect(result.label).toBe("heartbeat");
    });

    it("routes llm-task to utility model", () => {
      const router = createTestRouter("string-utility");
      const result = router.resolve({ taskType: "llm-task" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.taskType).toBe("llm-task");
      expect(result.label).toBe("llm-task");
    });

    it("all 5 task types classify and route without errors", () => {
      const router = createTestRouter("string-utility");
      for (const taskType of TASK_TYPES) {
        const result = router.resolve({ taskType });
        expect(result.provider).toBeTruthy();
        expect(result.modelId).toBeTruthy();
        expect(result.model).toBeTruthy();
        expect(result.taskType).toBe(taskType);
        expect(result.label).toBeTruthy();
      }
    });
  });

  // =========================================================================
  // Zero-config backward compatibility (T009)
  // =========================================================================

  describe("zero-config backward compatibility", () => {
    it("all task types resolve to primary model when roles is undefined", () => {
      const router = createTestRouter("zero-config");
      for (const taskType of TASK_TYPES) {
        const result = router.resolve({ taskType });
        expect(result.provider).toBe("anthropic");
        expect(result.modelId).toBe("claude-sonnet-4-5");
        expect(result.model).toBe(PRIMARY_MODEL);
        expect(result.isFallback).toBe(true);
      }
    });

    it("all task types resolve to primary model when roles is empty object", () => {
      const router = createTestRouter("empty-roles");
      for (const taskType of TASK_TYPES) {
        const result = router.resolve({ taskType });
        expect(result.provider).toBe("anthropic");
        expect(result.modelId).toBe("claude-sonnet-4-5");
        expect(result.model).toBe(PRIMARY_MODEL);
        expect(result.isFallback).toBe(true);
      }
    });

    it("reasoning task always uses primary model regardless of utility config", () => {
      const router = createTestRouter("string-utility");
      const result = router.resolve({ taskType: "reasoning" });
      expect(result.model).toBe(PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
    });

    it("preserves existing behavior with no role config changes", () => {
      const router = createTestRouter("zero-config");
      const reasoning = router.resolve({ taskType: "reasoning" });
      const compaction = router.resolve({ taskType: "compaction" });
      const memoryFlush = router.resolve({ taskType: "memory-flush" });

      // All should resolve identically to the primary model
      expect(reasoning.model).toBe(compaction.model);
      expect(compaction.model).toBe(memoryFlush.model);
      expect(reasoning.isFallback).toBe(true);
      expect(compaction.isFallback).toBe(true);
    });
  });

  // =========================================================================
  // Config variation tests (T010)
  // =========================================================================

  describe("config variations", () => {
    it("string shorthand resolves utility correctly", () => {
      const router = createTestRouter("string-utility");
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.params).toBeUndefined();
    });

    it("object form with params resolves utility correctly", () => {
      const router = createTestRouter("object-utility");
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
      expect(result.params).toEqual({ temperature: 0.1 });
    });

    it("empty roles object falls back to primary for all tasks", () => {
      const router = createTestRouter("empty-roles");
      for (const taskType of TASK_TYPES) {
        const result = router.resolve({ taskType });
        expect(result.isFallback).toBe(true);
        expect(result.model).toBe(PRIMARY_MODEL);
      }
    });

    it("partial roles (utility only) routes utility tasks correctly", () => {
      const router = createTestRouter("partial-utility");
      const utility = router.resolve({ taskType: "compaction" });
      const reasoning = router.resolve({ taskType: "reasoning" });

      expect(utility.provider).toBe("openai");
      expect(utility.isFallback).toBe(false);
      expect(reasoning.provider).toBe("anthropic");
      expect(reasoning.isFallback).toBe(true);
    });

    it("both roles configured resolves each independently", () => {
      const router = createTestRouter("both-roles");
      const reasoning = router.resolve({ taskType: "reasoning" });
      const utility = router.resolve({ taskType: "compaction" });

      // reasoning should use the configured reasoning model (not primary fallback)
      expect(reasoning.provider).toBe("anthropic");
      expect(reasoning.modelId).toBe("claude-opus-4-6");
      expect(reasoning.isFallback).toBe(false);

      // utility should use the configured utility model
      expect(utility.provider).toBe("openai");
      expect(utility.modelId).toBe("gpt-4o-mini");
      expect(utility.isFallback).toBe(false);
    });

    it("multi-provider routing resolves reasoning and utility to different providers", () => {
      const router = createTestRouter("google-utility");
      const reasoning = router.resolve({ taskType: "reasoning" });
      const utility = router.resolve({ taskType: "heartbeat" });

      expect(reasoning.provider).toBe("anthropic");
      expect(utility.provider).toBe("google");
      expect(utility.modelId).toBe("gemini-2.0-flash");
      expect(reasoning.provider).not.toBe(utility.provider);
    });
  });

  // =========================================================================
  // Fallback chain tests (T011)
  // =========================================================================

  describe("fallback chains", () => {
    it("falls back to primary when utility is not configured", () => {
      const router = createTestRouter("zero-config");
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4-5");
      expect(result.isFallback).toBe(true);
    });

    it("falls back to primary for invalid model reference (no slash)", () => {
      const router = createTestRouter("invalid-utility");
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4-5");
      expect(result.isFallback).toBe(true);
    });

    it("trims whitespace in model references correctly", () => {
      const router = createTestRouter("whitespace-utility");
      const result = router.resolve({ taskType: "compaction" });

      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
      expect(result.isFallback).toBe(false);
    });

    it("falls back for empty string utility config", () => {
      const roles: ModelRolesConfig = { utility: "" };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back for object form with empty model string", () => {
      const roles: ModelRolesConfig = { utility: { model: "" } };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back for model string with only provider (no model after slash)", () => {
      const roles: ModelRolesConfig = { utility: "openai/" };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("falls back for model string with only model (no provider before slash)", () => {
      const roles: ModelRolesConfig = { utility: "/gpt-4o-mini" };
      const router = createModelRouter(roles, PRIMARY_MODEL);
      const result = router.resolve({ taskType: "compaction" });

      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("unknown task types default to reasoning role and fall back to primary", () => {
      const router = createTestRouter("string-utility");
      const result = router.resolve({ taskType: "unknown-task" as TaskType });

      expect(result.provider).toBe("anthropic");
      expect(result.modelId).toBe("claude-sonnet-4-5");
      expect(result.isFallback).toBe(true);
    });
  });

  // =========================================================================
  // Rate limiter per-role tracking (T012)
  // =========================================================================

  describe("rate limiter per-role tracking", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("withRateLimitCheck passes role parameter through to recording", async () => {
      const limiter = createProviderRateLimiter({
        windowMs: WINDOW_MS,
        providers: { openai: { rpm: 60, tpm: 100_000 } },
      });

      const fn = vi.fn().mockResolvedValue({ totalTokens: 200 });

      await withRateLimitCheck({
        rateLimiter: limiter,
        provider: "openai",
        estimatedTokens: 100,
        actualTokens: (result: { totalTokens: number }) => result.totalTokens,
        role: "utility",
        fn,
      });

      expect(fn).toHaveBeenCalledTimes(1);
      const usage = limiter.getUsage("openai");
      expect(usage).not.toBeNull();
      expect(usage!.currentTpm).toBe(200);
      expect(usage!.currentRpm).toBe(1);
    });

    it("utility and reasoning calls record usage under the same provider bucket", async () => {
      const limiter = createProviderRateLimiter({
        windowMs: WINDOW_MS,
        providers: { openai: { rpm: 60, tpm: 100_000 } },
      });

      // Simulate utility call
      await withRateLimitCheck({
        rateLimiter: limiter,
        provider: "openai",
        estimatedTokens: 100,
        actualTokens: () => 300,
        role: "utility",
        fn: async () => ({ ok: true }),
      });

      // Simulate reasoning call
      await withRateLimitCheck({
        rateLimiter: limiter,
        provider: "openai",
        estimatedTokens: 200,
        actualTokens: () => 500,
        role: "reasoning",
        fn: async () => ({ ok: true }),
      });

      const usage = limiter.getUsage("openai");
      expect(usage!.currentTpm).toBe(800); // 300 + 500
      expect(usage!.currentRpm).toBe(2);
    });

    it("multi-provider usage tracks independently for different providers", async () => {
      const limiter = createProviderRateLimiter({
        windowMs: WINDOW_MS,
        providers: {
          openai: { rpm: 60, tpm: 100_000 },
          anthropic: { rpm: 30, tpm: 50_000 },
        },
      });

      // Utility call on openai
      await withRateLimitCheck({
        rateLimiter: limiter,
        provider: "openai",
        estimatedTokens: 100,
        actualTokens: () => 400,
        role: "utility",
        fn: async () => ({ ok: true }),
      });

      // Reasoning call on anthropic
      await withRateLimitCheck({
        rateLimiter: limiter,
        provider: "anthropic",
        estimatedTokens: 200,
        actualTokens: () => 600,
        role: "reasoning",
        fn: async () => ({ ok: true }),
      });

      const openaiUsage = limiter.getUsage("openai");
      const anthropicUsage = limiter.getUsage("anthropic");

      expect(openaiUsage!.currentTpm).toBe(400);
      expect(anthropicUsage!.currentTpm).toBe(600);
    });

    it("rate limiter rejects when utility exhausts provider RPM budget", async () => {
      const limiter = createProviderRateLimiter({
        windowMs: WINDOW_MS,
        providers: { openai: { rpm: 5, tpm: 100_000 } },
      });

      // Use up RPM budget with utility calls
      for (let i = 0; i < 5; i++) {
        limiter.recordUsage("openai", 10);
      }

      // Next call should be rejected
      await expect(
        withRateLimitCheck({
          rateLimiter: limiter,
          provider: "openai",
          role: "utility",
          fn: async () => ({ ok: true }),
        }),
      ).rejects.toThrow(/openai.*rpm/i);
    });

    it("passes through when rateLimiter is undefined regardless of role", async () => {
      const fn = vi.fn().mockResolvedValue({ done: true });
      const result = await withRateLimitCheck({
        rateLimiter: undefined,
        provider: "openai",
        role: "utility",
        fn,
      });

      expect(result).toEqual({ done: true });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // hasRole() and router edge cases (T013)
  // =========================================================================

  describe("hasRole() and router edge cases", () => {
    it("hasRole('utility') returns true when utility is configured", () => {
      const router = createTestRouter("string-utility");
      expect(router.hasRole("utility")).toBe(true);
    });

    it("hasRole('utility') returns false when roles is undefined", () => {
      const router = createTestRouter("zero-config");
      expect(router.hasRole("utility")).toBe(false);
    });

    it("hasRole('utility') returns false when roles is empty object", () => {
      const router = createTestRouter("empty-roles");
      expect(router.hasRole("utility")).toBe(false);
    });

    it("hasRole('utility') returns false for invalid model reference", () => {
      const router = createTestRouter("invalid-utility");
      expect(router.hasRole("utility")).toBe(false);
    });

    it("hasRole('reasoning') returns false when reasoning is not explicitly configured", () => {
      const router = createTestRouter("string-utility");
      // reasoning falls back to primary, so isFallback=true -> hasRole returns false
      expect(router.hasRole("reasoning")).toBe(false);
    });

    it("hasRole('reasoning') returns true when reasoning is explicitly configured", () => {
      const router = createTestRouter("both-roles");
      expect(router.hasRole("reasoning")).toBe(true);
    });

    it("repeated resolve calls return consistent results", () => {
      const router = createTestRouter("string-utility");
      const first = router.resolve({ taskType: "compaction" });
      const second = router.resolve({ taskType: "compaction" });

      expect(first.provider).toBe(second.provider);
      expect(first.modelId).toBe(second.modelId);
      expect(first.model).toBe(second.model);
      expect(first.isFallback).toBe(second.isFallback);
    });

    it("router works with object-form utility config", () => {
      const router = createTestRouter("object-utility");
      const result = router.resolve({ taskType: "heartbeat" });

      expect(result.params).toEqual({ temperature: 0.1 });
      expect(result.provider).toBe("openai");
      expect(result.isFallback).toBe(false);
    });
  });

  // =========================================================================
  // Classification layer validation
  // =========================================================================

  describe("classification layer validation", () => {
    it("classifyTask maps all 5 task types correctly", () => {
      const expectations: Array<{ taskType: TaskType; role: ModelRole; label: string }> = [
        { taskType: "reasoning", role: "reasoning", label: "agent-turn" },
        { taskType: "compaction", role: "utility", label: "compaction" },
        { taskType: "memory-flush", role: "utility", label: "memory-flush" },
        { taskType: "heartbeat", role: "utility", label: "heartbeat" },
        { taskType: "llm-task", role: "utility", label: "llm-task" },
      ];

      for (const exp of expectations) {
        const classification = classifyTask(exp.taskType);
        expect(classification.taskType).toBe(exp.taskType);
        expect(classification.role).toBe(exp.role);
        expect(classification.label).toBe(exp.label);
      }
    });

    it("classifyTask defaults unknown types to reasoning", () => {
      const classification = classifyTask("unknown-type");
      expect(classification.role).toBe("reasoning");
    });

    it("TASK_TYPES contains exactly 6 entries", () => {
      expect(TASK_TYPES).toHaveLength(6);
    });
  });

  // =========================================================================
  // Resolution layer validation
  // =========================================================================

  describe("resolution layer validation", () => {
    it("normalizeRoleConfig handles string shorthand", () => {
      const result = normalizeRoleConfig("openai/gpt-4o-mini");
      expect(result).toEqual({ model: "openai/gpt-4o-mini" });
    });

    it("normalizeRoleConfig handles object form with params", () => {
      const result = normalizeRoleConfig({
        model: "openai/gpt-4o-mini",
        params: { temperature: 0.1 },
      });
      expect(result).toEqual({ model: "openai/gpt-4o-mini", params: { temperature: 0.1 } });
    });

    it("normalizeRoleConfig returns null for undefined", () => {
      expect(normalizeRoleConfig(undefined)).toBeNull();
    });

    it("normalizeRoleConfig returns null for empty string", () => {
      expect(normalizeRoleConfig("")).toBeNull();
    });

    it("parseModelReference splits on first slash only", () => {
      const result = parseModelReference("anthropic/claude-sonnet-4-5");
      expect(result).toEqual({ provider: "anthropic", modelId: "claude-sonnet-4-5" });
    });

    it("parseModelReference trims whitespace", () => {
      const result = parseModelReference(" openai / gpt-4o-mini ");
      expect(result).toEqual({ provider: "openai", modelId: "gpt-4o-mini" });
    });

    it("parseModelReference returns null for invalid refs", () => {
      expect(parseModelReference("no-slash")).toBeNull();
      expect(parseModelReference("")).toBeNull();
      expect(parseModelReference("  ")).toBeNull();
    });

    it("resolveModelRole produces fallback for unconfigured utility", () => {
      const result = resolveModelRole("utility", undefined, PRIMARY_MODEL);
      expect(result.isFallback).toBe(true);
      expect(result.model).toBe(PRIMARY_MODEL);
    });

    it("resolveModelRole produces non-fallback for configured utility", () => {
      const roles: ModelRolesConfig = { utility: UTILITY_MODEL_STRING };
      const result = resolveModelRole("utility", roles, PRIMARY_MODEL);
      expect(result.isFallback).toBe(false);
      expect(result.provider).toBe("openai");
      expect(result.modelId).toBe("gpt-4o-mini");
    });
  });

  // =========================================================================
  // Full composed pipeline
  // =========================================================================

  describe("full composed pipeline", () => {
    it("config -> classify -> route -> result for each task type with utility configured", () => {
      const roles = createTestConfig("string-utility");
      const router = createModelRouter(roles, PRIMARY_MODEL);

      for (const taskType of TASK_TYPES) {
        const classification = classifyTask(taskType);
        const result = router.resolve({ taskType });

        // Classification and routing agree on role
        if (classification.role === "utility") {
          expect(result.provider).toBe("openai");
          expect(result.isFallback).toBe(false);
        } else {
          expect(result.provider).toBe("anthropic");
          expect(result.isFallback).toBe(true);
        }

        // Result carries classification metadata
        expect(result.taskType).toBe(classification.taskType);
        expect(result.label).toBe(classification.label);
      }
    });

    it("config -> classify -> route -> result for each task type with zero config", () => {
      const router = createModelRouter(undefined, PRIMARY_MODEL);

      for (const taskType of TASK_TYPES) {
        const result = router.resolve({ taskType });
        // All tasks fall back to primary
        expect(result.provider).toBe("anthropic");
        expect(result.modelId).toBe("claude-sonnet-4-5");
        expect(result.isFallback).toBe(true);
      }
    });

    it("composes correctly with rate limiter middleware", async () => {
      vi.useFakeTimers();
      try {
        const router = createTestRouter("string-utility");
        const limiter = createProviderRateLimiter({
          windowMs: WINDOW_MS,
          providers: { openai: { rpm: 60, tpm: 100_000 } },
        });

        // Route a compaction task
        const routeResult = router.resolve({ taskType: "compaction" });
        expect(routeResult.provider).toBe("openai");

        // Pass through rate limiter with role
        const role = routeResult.isFallback ? "reasoning" : "utility";
        const fn = vi.fn().mockResolvedValue({ tokens: 150 });

        await withRateLimitCheck({
          rateLimiter: limiter,
          provider: routeResult.provider,
          estimatedTokens: 100,
          actualTokens: (r: { tokens: number }) => r.tokens,
          role,
          fn,
        });

        expect(fn).toHaveBeenCalledTimes(1);
        const usage = limiter.getUsage("openai");
        expect(usage!.currentTpm).toBe(150);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
