import { describe, expect, it, vi } from "vitest";
import { enqueueAnnounce } from "./subagent-announce-queue.js";
import type { AnnounceQueueItem } from "./subagent-announce-queue.js";

function makeItem(prompt: string, sessionKey = "test"): AnnounceQueueItem {
  return {
    prompt,
    enqueuedAt: Date.now(),
    sessionKey,
  };
}

describe("announce queue send error isolation", () => {
  it("continues processing after a send failure", async () => {
    const sent: string[] = [];
    const send = vi.fn().mockImplementation(async (item: AnnounceQueueItem) => {
      if (item.prompt === "fail-me") {
        throw new Error("simulated send failure");
      }
      sent.push(item.prompt);
    });

    // Enqueue three items, second will fail
    enqueueAnnounce({
      key: "test-announce",
      item: makeItem("first"),
      settings: { mode: "individual", debounceMs: 0, cap: 20 },
      send,
    });
    enqueueAnnounce({
      key: "test-announce",
      item: makeItem("fail-me"),
      settings: { mode: "individual", debounceMs: 0, cap: 20 },
      send,
    });
    enqueueAnnounce({
      key: "test-announce",
      item: makeItem("third"),
      settings: { mode: "individual", debounceMs: 0, cap: 20 },
      send,
    });

    // Wait for async drain
    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledTimes(3);
    });

    // First and third should have been sent successfully
    expect(sent).toEqual(["first", "third"]);
  });
});
