import { describe, expect, it } from "vitest";
import { applyPluginAutoEnable } from "./plugin-auto-enable.js";

describe("applyPluginAutoEnable", () => {
  it("skips core channels (like telegram) since they are handled directly", () => {
    // Core channels (telegram) don't need plugin auto-enable - they're built-in
    const result = applyPluginAutoEnable({
      config: {
        channels: { telegram: { token: "x" } },
        plugins: { allow: ["msteams"] },
      },
      env: {},
    });

    // Telegram is a core channel, so it should NOT be auto-enabled as a plugin
    expect(result.config.plugins?.entries?.telegram?.enabled).toBeUndefined();
    // Allowlist remains unchanged since no plugins were auto-enabled
    expect(result.config.plugins?.allow).toEqual(["msteams"]);
    expect(result.changes).toEqual([]);
  });

  it("respects explicit disable", () => {
    const result = applyPluginAutoEnable({
      config: {
        channels: { telegram: { token: "x" } },
        plugins: { entries: { telegram: { enabled: false } } },
      },
      env: {},
    });

    expect(result.config.plugins?.entries?.telegram?.enabled).toBe(false);
    expect(result.changes).toEqual([]);
  });

  it("enables provider auth plugins when profiles exist", () => {
    const result = applyPluginAutoEnable({
      config: {
        auth: {
          profiles: {
            "google-antigravity:default": {
              provider: "google-antigravity",
              mode: "oauth",
            },
          },
        },
      },
      env: {},
    });

    expect(result.config.plugins?.entries?.["google-antigravity-auth"]?.enabled).toBe(true);
  });

  it("skips when plugins are globally disabled", () => {
    const result = applyPluginAutoEnable({
      config: {
        channels: { telegram: { token: "x" } },
        plugins: { enabled: false },
      },
      env: {},
    });

    expect(result.config.plugins?.entries?.telegram?.enabled).toBeUndefined();
    expect(result.changes).toEqual([]);
  });
});
