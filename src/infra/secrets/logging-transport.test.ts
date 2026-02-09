import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMaskingTransport, maskStringsDeep } from "./logging-transport.js";
import { SecretsRegistry } from "./registry.js";

describe("maskStringsDeep", () => {
  let registry: SecretsRegistry;

  beforeEach(() => {
    SecretsRegistry.reset();
    registry = SecretsRegistry.getInstance();
    registry.register("test-key", "sk-my-super-secret-key-12345678");
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  it("masks string values", () => {
    const result = maskStringsDeep(
      "contains sk-my-super-secret-key-12345678 here",
      registry,
      false,
    );
    expect(result).not.toContain("sk-my-super-secret-key-12345678");
    expect(result).toMatch(/\{\{SECRET:[0-9a-f]{8}\}\}/);
  });

  it("passes null through unchanged", () => {
    expect(maskStringsDeep(null, registry, false)).toBeNull();
  });

  it("passes undefined through unchanged", () => {
    expect(maskStringsDeep(undefined, registry, false)).toBeUndefined();
  });

  it("passes numbers through unchanged", () => {
    expect(maskStringsDeep(42, registry, false)).toBe(42);
  });

  it("passes booleans through unchanged", () => {
    expect(maskStringsDeep(true, registry, false)).toBe(true);
  });

  it("recursively masks strings in objects", () => {
    const input = {
      message: "key is sk-my-super-secret-key-12345678",
      level: 3,
      nested: {
        data: "also sk-my-super-secret-key-12345678",
      },
    };
    const result = maskStringsDeep(input, registry, false) as Record<string, unknown>;
    expect(result.message).not.toContain("sk-my-super-secret-key-12345678");
    expect((result.nested as Record<string, unknown>).data).not.toContain(
      "sk-my-super-secret-key-12345678",
    );
    expect(result.level).toBe(3);
  });

  it("recursively masks strings in arrays", () => {
    const input = ["contains sk-my-super-secret-key-12345678", 42, null];
    const result = maskStringsDeep(input, registry, false) as unknown[];
    expect(result[0]).not.toContain("sk-my-super-secret-key-12345678");
    expect(result[1]).toBe(42);
    expect(result[2]).toBeNull();
  });

  it("does not mask when no secrets match", () => {
    const input = "no secrets here at all";
    expect(maskStringsDeep(input, registry, false)).toBe(input);
  });

  it("applies pattern-based redaction when enabled", () => {
    // Use a fresh registry with no registered secrets
    SecretsRegistry.reset();
    const emptyRegistry = SecretsRegistry.getInstance();
    const input = "token is sk-anotherUnregisteredKeyValue1234";
    const result = maskStringsDeep(input, emptyRegistry, true) as string;
    // Pattern-based redaction should truncate the sk-* token
    expect(result).not.toBe(input);
  });

  it("composes both masking strategies (value first, pattern second)", () => {
    // Register a specific secret
    registry.register("specific", "my-specific-api-secret-value");
    const input = "has my-specific-api-secret-value and sk-anotherPatternMatchKey1234";
    const result = maskStringsDeep(input, registry, true) as string;
    // Value-based should mask the registered secret
    expect(result).not.toContain("my-specific-api-secret-value");
    // Pattern-based should handle the sk-* pattern
    expect(result).not.toContain("sk-anotherPatternMatchKey1234");
  });
});

describe("createMaskingTransport", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
    const registry = SecretsRegistry.getInstance();
    registry.register("test-secret", "sk-transport-test-secret-value-12345");
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  it("masks string fields in a log record", () => {
    const transport = createMaskingTransport();
    const logObj: Record<string, unknown> = {
      0: "Log message with sk-transport-test-secret-value-12345",
      _meta: { name: "test" },
      date: new Date(),
    };
    transport(logObj);
    expect(logObj[0]).not.toContain("sk-transport-test-secret-value-12345");
  });

  it("preserves non-string fields", () => {
    const transport = createMaskingTransport();
    const date = new Date();
    const logObj: Record<string, unknown> = {
      0: "safe message",
      level: 3,
      date,
      isError: false,
    };
    transport(logObj);
    expect(logObj.level).toBe(3);
    expect(logObj.isError).toBe(false);
  });

  it("masks nested objects in log records", () => {
    const transport = createMaskingTransport();
    const logObj: Record<string, unknown> = {
      0: "safe message",
      context: {
        key: "sk-transport-test-secret-value-12345",
        count: 5,
      },
    };
    transport(logObj);
    const context = logObj.context as Record<string, unknown>;
    expect(context.key).not.toContain("sk-transport-test-secret-value-12345");
    expect(context.count).toBe(5);
  });

  it("handles empty log record", () => {
    const transport = createMaskingTransport();
    const logObj: Record<string, unknown> = {};
    expect(() => transport(logObj)).not.toThrow();
  });

  it("handles log record with no secrets present", () => {
    const transport = createMaskingTransport();
    const logObj: Record<string, unknown> = {
      0: "no secrets here",
      level: 2,
    };
    transport(logObj);
    expect(logObj[0]).toBe("no secrets here");
  });
});
