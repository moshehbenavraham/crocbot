import { describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "./with-timeout.js";

describe("withTimeout", () => {
  it("resolves when promise completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  it("rejects with TimeoutError when promise exceeds timeout", async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve("too late"), 5000);
    });
    await expect(withTimeout(slow, 50)).rejects.toThrow(TimeoutError);
  });

  it("rejects with the promise error if it rejects before timeout", async () => {
    const failing = Promise.reject(new Error("boom"));
    await expect(withTimeout(failing, 1000)).rejects.toThrow("boom");
  });

  it("rejects immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("pre-aborted"));
    await expect(withTimeout(Promise.resolve(1), 1000, controller.signal)).rejects.toThrow(
      "pre-aborted",
    );
  });

  it("rejects when external signal aborts before timeout", async () => {
    const controller = new AbortController();
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve("late"), 5000);
    });
    setTimeout(() => controller.abort(new Error("cancelled")), 30);
    await expect(withTimeout(slow, 5000, controller.signal)).rejects.toThrow("cancelled");
  });

  it("TimeoutError has correct name property", () => {
    const err = new TimeoutError("test");
    expect(err.name).toBe("TimeoutError");
    expect(err.message).toBe("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("uses default message when none provided", () => {
    const err = new TimeoutError();
    expect(err.message).toBe("Operation timed out");
  });
});
