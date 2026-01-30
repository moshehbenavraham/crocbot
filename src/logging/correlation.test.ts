import { describe, expect, it } from "vitest";

import {
  generateCorrelationId,
  getCorrelationContext,
  getCorrelationId,
  runWithCorrelation,
  runWithCorrelationAsync,
  updateCorrelationContext,
} from "./correlation.js";

describe("generateCorrelationId", () => {
  it("generates 8-character IDs", () => {
    const id = generateCorrelationId();
    expect(id).toHaveLength(8);
  });

  it("generates hex characters only", () => {
    const id = generateCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateCorrelationId());
    }
    expect(ids.size).toBe(100);
  });
});

describe("runWithCorrelation", () => {
  it("runs function with generated correlation ID", () => {
    let capturedId: string | undefined;
    runWithCorrelation(() => {
      capturedId = getCorrelationId();
    });
    expect(capturedId).toBeDefined();
    expect(capturedId).toHaveLength(8);
  });

  it("uses provided correlation ID", () => {
    let capturedId: string | undefined;
    runWithCorrelation(
      () => {
        capturedId = getCorrelationId();
      },
      { correlationId: "custom01" },
    );
    expect(capturedId).toBe("custom01");
  });

  it("includes chat context when provided", () => {
    let capturedCtx: ReturnType<typeof getCorrelationContext>;
    runWithCorrelation(
      () => {
        capturedCtx = getCorrelationContext();
      },
      { chatId: 123, userId: 456, messageId: 789 },
    );
    expect(capturedCtx?.chatId).toBe(123);
    expect(capturedCtx?.userId).toBe(456);
    expect(capturedCtx?.messageId).toBe(789);
  });

  it("returns function result", () => {
    const result = runWithCorrelation(() => 42);
    expect(result).toBe(42);
  });
});

describe("runWithCorrelationAsync", () => {
  it("runs async function with correlation context", async () => {
    let capturedId: string | undefined;
    await runWithCorrelationAsync(async () => {
      await Promise.resolve();
      capturedId = getCorrelationId();
    });
    expect(capturedId).toBeDefined();
    expect(capturedId).toHaveLength(8);
  });

  it("preserves context across await boundaries", async () => {
    let idBefore: string | undefined;
    let idAfter: string | undefined;
    await runWithCorrelationAsync(async () => {
      idBefore = getCorrelationId();
      await new Promise((resolve) => setTimeout(resolve, 1));
      idAfter = getCorrelationId();
    });
    expect(idBefore).toBe(idAfter);
  });

  it("returns async function result", async () => {
    const result = await runWithCorrelationAsync(async () => {
      await Promise.resolve();
      return "async-result";
    });
    expect(result).toBe("async-result");
  });
});

describe("getCorrelationContext", () => {
  it("returns undefined outside of correlation context", () => {
    expect(getCorrelationContext()).toBeUndefined();
  });

  it("returns full context inside correlation run", () => {
    runWithCorrelation(
      () => {
        const ctx = getCorrelationContext();
        expect(ctx).toBeDefined();
        expect(ctx?.correlationId).toBe("test1234");
        expect(ctx?.chatId).toBe(100);
      },
      { correlationId: "test1234", chatId: 100 },
    );
  });
});

describe("getCorrelationId", () => {
  it("returns undefined outside of correlation context", () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it("returns correlation ID inside correlation run", () => {
    runWithCorrelation(
      () => {
        expect(getCorrelationId()).toBe("abcd1234");
      },
      { correlationId: "abcd1234" },
    );
  });
});

describe("updateCorrelationContext", () => {
  it("returns false outside of correlation context", () => {
    expect(updateCorrelationContext({ chatId: 123 })).toBe(false);
  });

  it("updates context inside correlation run", () => {
    runWithCorrelation(() => {
      const updated = updateCorrelationContext({
        chatId: 999,
        userId: 888,
        messageId: 777,
      });
      expect(updated).toBe(true);
      const ctx = getCorrelationContext();
      expect(ctx?.chatId).toBe(999);
      expect(ctx?.userId).toBe(888);
      expect(ctx?.messageId).toBe(777);
    });
  });

  it("preserves original correlation ID when updating", () => {
    runWithCorrelation(
      () => {
        updateCorrelationContext({ chatId: 111 });
        expect(getCorrelationId()).toBe("orig1234");
      },
      { correlationId: "orig1234" },
    );
  });
});
