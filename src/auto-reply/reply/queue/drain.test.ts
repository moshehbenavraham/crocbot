import { describe, expect, it, vi, afterEach } from "vitest";
import { scheduleFollowupDrain } from "./drain.js";
import { FOLLOWUP_QUEUES } from "./state.js";
import type { FollowupRun } from "./types.js";

// Minimal queue state factory
function makeQueue(items: FollowupRun[]) {
  const queue = {
    items: [...items],
    draining: false,
    lastEnqueuedAt: Date.now(),
    mode: "individual" as const,
    debounceMs: 0,
    cap: 20,
    dropPolicy: "summarize" as const,
    droppedCount: 0,
    summaryLines: [] as string[],
    lastRun: undefined,
  };
  return queue;
}

function makeItem(prompt: string): FollowupRun {
  return {
    prompt,
    run: {} as FollowupRun["run"],
    enqueuedAt: Date.now(),
  };
}

describe("scheduleFollowupDrain error isolation", () => {
  afterEach(() => {
    FOLLOWUP_QUEUES.clear();
  });

  it("continues processing after a single item fails", async () => {
    const items = [makeItem("first"), makeItem("second"), makeItem("third")];
    const queue = makeQueue(items);
    FOLLOWUP_QUEUES.set("test-key", queue as never);

    const processed: string[] = [];
    const runFollowup = vi.fn().mockImplementation(async (run: FollowupRun) => {
      if (run.prompt === "second") {
        throw new Error("simulated send failure");
      }
      processed.push(run.prompt);
    });

    scheduleFollowupDrain("test-key", runFollowup);

    // Wait for async drain to complete
    await vi.waitFor(() => {
      expect(runFollowup).toHaveBeenCalledTimes(3);
    });

    // First and third should have been processed; second threw but didn't stop the drain
    expect(processed).toEqual(["first", "third"]);
  });
});
