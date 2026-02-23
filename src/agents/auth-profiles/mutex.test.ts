import { describe, expect, it } from "vitest";
import { createMutex } from "./mutex.js";

describe("createMutex", () => {
  it("serializes concurrent callers", async () => {
    const mutex = createMutex();
    const order: number[] = [];

    const run = async (id: number, delayMs: number) => {
      const release = await mutex.acquire();
      try {
        order.push(id);
        await new Promise((r) => setTimeout(r, delayMs));
      } finally {
        release();
      }
    };

    await Promise.all([run(1, 30), run(2, 10), run(3, 10)]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("propagates errors without blocking subsequent callers", async () => {
    const mutex = createMutex();
    const order: string[] = [];

    const p1 = (async () => {
      const release = await mutex.acquire();
      try {
        order.push("p1-acquired");
        throw new Error("p1 error");
      } finally {
        release();
      }
    })();

    const p2 = (async () => {
      const release = await mutex.acquire();
      try {
        order.push("p2-acquired");
      } finally {
        release();
      }
    })();

    const p3 = (async () => {
      const release = await mutex.acquire();
      try {
        order.push("p3-acquired");
      } finally {
        release();
      }
    })();

    await expect(p1).rejects.toThrow("p1 error");
    await p2;
    await p3;

    expect(order).toEqual(["p1-acquired", "p2-acquired", "p3-acquired"]);
  });

  it("handles rapid sequential calls", async () => {
    const mutex = createMutex();
    const results: number[] = [];

    for (let i = 0; i < 10; i++) {
      const release = await mutex.acquire();
      results.push(i);
      release();
    }

    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("supports nested acquire from the same async context after release", async () => {
    const mutex = createMutex();
    const order: string[] = [];

    const release1 = await mutex.acquire();
    order.push("outer-acquired");
    release1();

    const release2 = await mutex.acquire();
    order.push("inner-acquired");
    release2();

    expect(order).toEqual(["outer-acquired", "inner-acquired"]);
  });
});
