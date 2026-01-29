import { describe, expect, it } from "vitest";

import { normalizePluginsConfig } from "./config-state.js";

describe("normalizePluginsConfig", () => {
  // memory-core extension removed in session 02; default slot is now undefined
  it("uses undefined memory slot when not specified", () => {
    const result = normalizePluginsConfig({});
    expect(result.slots.memory).toBeUndefined();
  });

  it("respects explicit memory slot value", () => {
    const result = normalizePluginsConfig({
      slots: { memory: "custom-memory" },
    });
    expect(result.slots.memory).toBe("custom-memory");
  });

  it("disables memory slot when set to 'none'", () => {
    const result = normalizePluginsConfig({
      slots: { memory: "none" },
    });
    expect(result.slots.memory).toBeNull();
  });

  it("disables memory slot when set to 'None' (case insensitive)", () => {
    const result = normalizePluginsConfig({
      slots: { memory: "None" },
    });
    expect(result.slots.memory).toBeNull();
  });

  it("trims whitespace from memory slot value", () => {
    const result = normalizePluginsConfig({
      slots: { memory: "  custom-memory  " },
    });
    expect(result.slots.memory).toBe("custom-memory");
  });

  // memory-core extension removed in session 02; default slot is now undefined
  it("uses undefined when memory slot is empty string", () => {
    const result = normalizePluginsConfig({
      slots: { memory: "" },
    });
    expect(result.slots.memory).toBeUndefined();
  });

  it("uses undefined when memory slot is whitespace only", () => {
    const result = normalizePluginsConfig({
      slots: { memory: "   " },
    });
    expect(result.slots.memory).toBeUndefined();
  });
});
