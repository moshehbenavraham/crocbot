import { beforeEach, describe, expect, it, vi } from "vitest";

import { createKeyPool } from "./key-pool.js";

import type { KeyPoolDeps, KeyPoolEntry } from "./key-pool.js";
import type { RateLimitCheckResult } from "./provider-rate-limiter-config.js";

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockRateLimiter() {
  const tryAcquire = vi
    .fn<(id: string, tokens?: number) => RateLimitCheckResult>()
    .mockReturnValue({ allowed: true, retryAfterMs: 0 });
  const recordUsage = vi.fn();
  const recordRateLimitHit = vi.fn();
  const getUsage = vi.fn().mockReturnValue(null);
  const reset = vi.fn();
  return { tryAcquire, recordUsage, recordRateLimitHit, getUsage, reset };
}

function createMockSecretsRegistry() {
  const register = vi.fn().mockReturnValue(true);
  return {
    register,
    unregister: vi.fn().mockReturnValue(true),
    mask: vi.fn((text: string) => text),
    unmask: vi.fn((text: string) => text),
    init: vi.fn(),
    has: vi.fn().mockReturnValue(false),
    get size() {
      return 0;
    },
    get patternCount() {
      return 0;
    },
    get maxSecretLength() {
      return 0;
    },
  };
}

function createMockDeps(overrides?: Partial<KeyPoolDeps>) {
  const rateLimiter = createMockRateLimiter();
  const secretsRegistry = createMockSecretsRegistry();
  return {
    isInCooldown: vi.fn().mockReturnValue(false),
    resolveOrder: vi.fn((providerId: string) => {
      return [`${providerId}-1`, `${providerId}-2`, `${providerId}-3`];
    }),
    markFailure: vi.fn(),
    markUsed: vi.fn(),
    rateLimiter,
    secretsRegistry,
    ...overrides,
  } as unknown as KeyPoolDeps;
}

function createEntries(providerId: string, count: number): KeyPoolEntry[] {
  const entries: KeyPoolEntry[] = [];
  for (let i = 1; i <= count; i++) {
    entries.push({
      profileId: `${providerId}-${i}`,
      providerId,
      apiKey: `sk-test-key-${providerId}-${i}`,
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createKeyPool", () => {
  describe("SecretsRegistry integration", () => {
    it("registers all API key values with SecretsRegistry at creation", () => {
      const registerFn = vi.fn().mockReturnValue(true);
      const secretsRegistry = { ...createMockSecretsRegistry(), register: registerFn };
      const deps = createMockDeps({ secretsRegistry } as unknown as Partial<KeyPoolDeps>);
      const entries = createEntries("openai", 3);

      const pool = createKeyPool(entries, deps);

      expect(registerFn).toHaveBeenCalledTimes(3);
      expect(registerFn).toHaveBeenCalledWith("key-pool:openai-1", "sk-test-key-openai-1");
      expect(registerFn).toHaveBeenCalledWith("key-pool:openai-2", "sk-test-key-openai-2");
      expect(registerFn).toHaveBeenCalledWith("key-pool:openai-3", "sk-test-key-openai-3");
      expect(pool.registeredCount).toBe(3);
    });

    it("tracks registeredCount based on successful registrations", () => {
      const registerFn = vi
        .fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      const secretsRegistry = { ...createMockSecretsRegistry(), register: registerFn };
      const deps = createMockDeps({ secretsRegistry } as unknown as Partial<KeyPoolDeps>);
      const entries = createEntries("openai", 3);

      const pool = createKeyPool(entries, deps);

      expect(pool.registeredCount).toBe(2);
    });
  });

  describe("selectKey - round-robin ordering", () => {
    it("selects keys in the order returned by resolveOrder", () => {
      const entries = createEntries("openai", 3);
      const deps = createMockDeps({
        resolveOrder: vi.fn().mockReturnValue(["openai-1", "openai-2", "openai-3"]),
      });

      const pool = createKeyPool(entries, deps);

      const key1 = pool.selectKey("openai");
      expect(key1).not.toBeNull();
      expect(key1!.profileId).toBe("openai-1");

      const key2 = pool.selectKey("openai");
      expect(key2!.profileId).toBe("openai-1");
    });

    it("returns the first non-cooldown key from ordered list", () => {
      const entries = createEntries("openai", 3);
      const deps = createMockDeps({
        resolveOrder: vi.fn().mockReturnValue(["openai-1", "openai-2", "openai-3"]),
        isInCooldown: vi.fn((profileId: string) => profileId === "openai-1"),
      });

      const pool = createKeyPool(entries, deps);
      const key = pool.selectKey("openai");

      expect(key).not.toBeNull();
      expect(key!.profileId).toBe("openai-2");
    });

    it("skips degraded key B, cycles A -> C -> A -> C", () => {
      const entries = createEntries("openai", 3);
      const deps = createMockDeps({
        resolveOrder: vi.fn().mockReturnValue(["openai-1", "openai-2", "openai-3"]),
        isInCooldown: vi.fn((profileId: string) => profileId === "openai-2"),
      });

      const pool = createKeyPool(entries, deps);

      expect(pool.selectKey("openai")!.profileId).toBe("openai-1");
      expect(pool.selectKey("openai")!.profileId).toBe("openai-1");
    });
  });

  describe("selectKey - rate limiter integration", () => {
    it("returns null when rate limiter blocks provider", () => {
      const entries = createEntries("openai", 3);
      const tryAcquire = vi.fn().mockReturnValue({ allowed: false, retryAfterMs: 5000 });
      const rateLimiter = { ...createMockRateLimiter(), tryAcquire };
      const deps = createMockDeps({ rateLimiter });

      const pool = createKeyPool(entries, deps);
      const key = pool.selectKey("openai");

      expect(key).toBeNull();
    });

    it("passes estimatedTokens to tryAcquire", () => {
      const entries = createEntries("openai", 3);
      const tryAcquire = vi
        .fn<(id: string, tokens?: number) => RateLimitCheckResult>()
        .mockReturnValue({ allowed: true, retryAfterMs: 0 });
      const rateLimiter = { ...createMockRateLimiter(), tryAcquire };
      const deps = createMockDeps({ rateLimiter });

      const pool = createKeyPool(entries, deps);
      pool.selectKey("openai", 1500);

      expect(tryAcquire).toHaveBeenCalledWith("openai", 1500);
    });
  });

  describe("selectKey - all unavailable", () => {
    it("returns null when all keys are in cooldown", () => {
      const entries = createEntries("openai", 3);
      const deps = createMockDeps({
        resolveOrder: vi.fn().mockReturnValue(["openai-1", "openai-2", "openai-3"]),
        isInCooldown: vi.fn().mockReturnValue(true),
      });

      const pool = createKeyPool(entries, deps);
      expect(pool.selectKey("openai")).toBeNull();
    });

    it("returns null when provider has zero keys", () => {
      const entries = createEntries("openai", 2);
      const deps = createMockDeps();

      const pool = createKeyPool(entries, deps);
      expect(pool.selectKey("anthropic")).toBeNull();
    });

    it("returns null for empty entries array", () => {
      const deps = createMockDeps();
      const pool = createKeyPool([], deps);

      expect(pool.selectKey("openai")).toBeNull();
    });
  });

  describe("selectKey - recovery after cooldown", () => {
    it("returns key after it exits cooldown", () => {
      const entries = createEntries("openai", 2);
      const cooldownSet = new Set(["openai-1", "openai-2"]);
      const deps = createMockDeps({
        resolveOrder: vi.fn().mockReturnValue(["openai-1", "openai-2"]),
        isInCooldown: vi.fn((id: string) => cooldownSet.has(id)),
      });

      const pool = createKeyPool(entries, deps);

      expect(pool.selectKey("openai")).toBeNull();

      cooldownSet.delete("openai-1");
      expect(pool.selectKey("openai")!.profileId).toBe("openai-1");
    });
  });

  describe("selectKey - provider normalization", () => {
    it("normalizes provider ID to lowercase", () => {
      const entries: KeyPoolEntry[] = [
        { profileId: "openai-1", providerId: "OpenAI", apiKey: "sk-test-1" },
      ];
      const deps = createMockDeps({
        resolveOrder: vi.fn().mockReturnValue(["openai-1"]),
      });

      const pool = createKeyPool(entries, deps);
      const key = pool.selectKey("OPENAI");

      expect(key).not.toBeNull();
      expect(key!.profileId).toBe("openai-1");
    });
  });

  describe("reportSuccess", () => {
    it("delegates to markUsed", () => {
      const deps = createMockDeps();
      const pool = createKeyPool(createEntries("openai", 1), deps);

      pool.reportSuccess("openai-1");

      expect(deps.markUsed).toHaveBeenCalledWith("openai-1");
    });
  });

  describe("reportFailure", () => {
    let deps: KeyPoolDeps;
    let entries: KeyPoolEntry[];
    let recordRateLimitHit: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      recordRateLimitHit = vi.fn();
      const rateLimiter = { ...createMockRateLimiter(), recordRateLimitHit };
      deps = createMockDeps({
        resolveOrder: vi.fn().mockReturnValue(["openai-1"]),
        rateLimiter,
      });
      entries = createEntries("openai", 1);
    });

    it("marks auth profile failure on 401", () => {
      const pool = createKeyPool(entries, deps);
      pool.reportFailure("openai-1", "auth", 401);

      expect(deps.markFailure).toHaveBeenCalledWith("openai-1", "auth");
    });

    it("marks auth profile failure on 403", () => {
      const pool = createKeyPool(entries, deps);
      pool.reportFailure("openai-1", "auth", 403);

      expect(deps.markFailure).toHaveBeenCalledWith("openai-1", "auth");
    });

    it("marks both profile failure and rate limit hit on 429", () => {
      const pool = createKeyPool(entries, deps);
      pool.reportFailure("openai-1", "rate_limit", 429);

      expect(deps.markFailure).toHaveBeenCalledWith("openai-1", "rate_limit");
      expect(recordRateLimitHit).toHaveBeenCalledWith("openai");
    });

    it("records rate limit hit when reason is rate_limit without status", () => {
      const pool = createKeyPool(entries, deps);
      pool.reportFailure("openai-1", "rate_limit");

      expect(deps.markFailure).toHaveBeenCalledWith("openai-1", "rate_limit");
      expect(recordRateLimitHit).toHaveBeenCalledWith("openai");
    });

    it("marks profile failure on 5xx without recording rate limit hit", () => {
      const pool = createKeyPool(entries, deps);
      pool.reportFailure("openai-1", "timeout", 502);

      expect(deps.markFailure).toHaveBeenCalledWith("openai-1", "timeout");
      expect(recordRateLimitHit).not.toHaveBeenCalled();
    });

    it("handles unknown profile ID gracefully in rate limit feedback", () => {
      const pool = createKeyPool(entries, deps);
      pool.reportFailure("unknown-99", "rate_limit", 429);

      expect(deps.markFailure).toHaveBeenCalledWith("unknown-99", "rate_limit");
      expect(recordRateLimitHit).not.toHaveBeenCalled();
    });
  });
});
