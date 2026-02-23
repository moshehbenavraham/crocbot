import { describe, expect, test } from "vitest";
import { applyMergePatch } from "./merge-patch.js";

describe("applyMergePatch", () => {
  test("basic RFC 7386 merge", () => {
    const base = { a: 1, b: "hello" };
    const patch = { b: "world", c: 3 };
    expect(applyMergePatch(base, patch)).toEqual({ a: 1, b: "world", c: 3 });
  });

  test("null removes keys", () => {
    const base = { a: 1, b: 2 };
    const patch = { b: null };
    expect(applyMergePatch(base, patch)).toEqual({ a: 1 });
  });

  test("recursive merge for nested objects", () => {
    const base = { a: { x: 1, y: 2 } };
    const patch = { a: { y: 3, z: 4 } };
    expect(applyMergePatch(base, patch)).toEqual({ a: { x: 1, y: 3, z: 4 } });
  });

  test("arrays replace by default", () => {
    const base = { items: [{ id: "a", v: 1 }] };
    const patch = { items: [{ id: "b", v: 2 }] };
    expect(applyMergePatch(base, patch)).toEqual({ items: [{ id: "b", v: 2 }] });
  });
});

describe("applyMergePatch with mergeObjectArraysById", () => {
  const opts = { mergeObjectArraysById: true };

  test("merges arrays by id field", () => {
    const base = {
      items: [
        { id: "a", v: 1 },
        { id: "b", v: 2 },
      ],
    };
    const patch = { items: [{ id: "a", v: 10 }] };
    expect(applyMergePatch(base, patch, opts)).toEqual({
      items: [
        { id: "a", v: 10 },
        { id: "b", v: 2 },
      ],
    });
  });

  test("adds new entries from patch", () => {
    const base = { items: [{ id: "a", v: 1 }] };
    const patch = { items: [{ id: "b", v: 2 }] };
    expect(applyMergePatch(base, patch, opts)).toEqual({
      items: [
        { id: "a", v: 1 },
        { id: "b", v: 2 },
      ],
    });
  });

  test("merges nested properties by id", () => {
    const base = { items: [{ id: "a", nested: { x: 1, y: 2 } }] };
    const patch = { items: [{ id: "a", nested: { y: 3 } }] };
    expect(applyMergePatch(base, patch, opts)).toEqual({
      items: [{ id: "a", nested: { x: 1, y: 3 } }],
    });
  });

  test("falls back to replace when items lack id field", () => {
    const base = { items: [{ name: "a" }] };
    const patch = { items: [{ name: "b" }] };
    expect(applyMergePatch(base, patch, opts)).toEqual({
      items: [{ name: "b" }],
    });
  });

  test("falls back to replace when mixed objects and primitives", () => {
    const base = { items: [{ id: "a" }, "string"] };
    const patch = { items: [{ id: "b" }] };
    expect(applyMergePatch(base, patch, opts)).toEqual({
      items: [{ id: "b" }],
    });
  });

  test("preserves order: base items first, then new from patch", () => {
    const base = {
      items: [
        { id: "b", v: 1 },
        { id: "a", v: 2 },
      ],
    };
    const patch = {
      items: [
        { id: "c", v: 3 },
        { id: "a", v: 20 },
      ],
    };
    const result = applyMergePatch(base, patch, opts) as { items: { id: string; v: number }[] };
    expect(result.items.map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(result.items[1].v).toBe(20);
  });
});
