import { afterEach, describe, expect, it, vi } from "vitest";
import type { crocbotConfig } from "../config/config.js";
import { startHeartbeatRunner } from "./heartbeat-runner.js";

describe("heartbeat runner per-agent error isolation", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("continues to run other agents after one agent throws", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    let callCount = 0;
    const runSpy = vi.fn().mockImplementation(async (opts: { agentId: string }) => {
      callCount += 1;
      if (opts.agentId === "main") {
        throw new Error("simulated runOnce failure");
      }
      return { status: "ran", durationMs: 1 };
    });

    const runner = startHeartbeatRunner({
      cfg: {
        agents: {
          defaults: { heartbeat: { every: "10m" } },
          list: [
            { id: "main", heartbeat: { every: "10m" } },
            { id: "ops", heartbeat: { every: "10m" } },
          ],
        },
      } as crocbotConfig,
      runOnce: runSpy,
    });

    // Advance past first interval - both agents should be attempted
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1_000);

    // Both agents should have been called even though "main" threw
    expect(runSpy).toHaveBeenCalledTimes(2);
    expect(runSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ agentId: "main" }));
    expect(runSpy.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ agentId: "ops" }));

    runner.stop();
  });

  it("re-schedules after runOnce throws", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const runSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValue({ status: "ran", durationMs: 1 });

    const runner = startHeartbeatRunner({
      cfg: {
        agents: { defaults: { heartbeat: { every: "10m" } } },
      } as crocbotConfig,
      runOnce: runSpy,
    });

    // First interval - runOnce throws
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1_000);
    expect(runSpy).toHaveBeenCalledTimes(1);

    // Second interval - runOnce succeeds (scheduler survived)
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1_000);
    expect(runSpy).toHaveBeenCalledTimes(2);

    runner.stop();
  });
});
