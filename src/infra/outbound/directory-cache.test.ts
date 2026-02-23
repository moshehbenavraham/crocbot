import { describe, expect, it, vi } from "vitest";
import { DirectoryCache } from "./directory-cache.js";
import type { crocbotConfig } from "../../config/config.js";

const cfg = {} as crocbotConfig;

describe("DirectoryCache", () => {
  describe("max-entries eviction", () => {
    it("evicts oldest entry when set exceeds maxSize", () => {
      const cache = new DirectoryCache<string>(60_000, 3);

      cache.set("a", "val-a", cfg);
      cache.set("b", "val-b", cfg);
      cache.set("c", "val-c", cfg);

      // Adding a 4th should evict "a" (oldest by insertion order)
      cache.set("d", "val-d", cfg);

      expect(cache.get("a", cfg)).toBeUndefined();
      expect(cache.get("b", cfg)).toBe("val-b");
      expect(cache.get("c", cfg)).toBe("val-c");
      expect(cache.get("d", cfg)).toBe("val-d");
    });

    it("does not evict when under maxSize", () => {
      const cache = new DirectoryCache<number>(60_000, 5);

      cache.set("x", 1, cfg);
      cache.set("y", 2, cfg);
      cache.set("z", 3, cfg);

      expect(cache.get("x", cfg)).toBe(1);
      expect(cache.get("y", cfg)).toBe(2);
      expect(cache.get("z", cfg)).toBe(3);
    });

    it("uses default maxSize of 200 when not specified", () => {
      const cache = new DirectoryCache<string>(60_000);

      // Fill to 200 entries
      for (let i = 0; i < 200; i++) {
        cache.set(`key-${i}`, `val-${i}`, cfg);
      }

      // 201st should evict the first
      cache.set("overflow", "overflow-val", cfg);
      expect(cache.get("key-0", cfg)).toBeUndefined();
      expect(cache.get("overflow", cfg)).toBe("overflow-val");
    });

    it("updates existing key without eviction", () => {
      const cache = new DirectoryCache<string>(60_000, 2);

      cache.set("a", "v1", cfg);
      cache.set("b", "v2", cfg);
      cache.set("a", "v3", cfg); // Update, not new entry

      expect(cache.get("a", cfg)).toBe("v3");
      expect(cache.get("b", cfg)).toBe("v2");
    });
  });

  describe("TTL expiration", () => {
    it("returns undefined for expired entries", () => {
      vi.useFakeTimers();
      const cache = new DirectoryCache<string>(1_000, 10);

      cache.set("k", "v", cfg);
      expect(cache.get("k", cfg)).toBe("v");

      vi.advanceTimersByTime(1_500);
      expect(cache.get("k", cfg)).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe("LRU get reordering", () => {
    it("moves accessed entries to end of eviction order", () => {
      const cache = new DirectoryCache<string>(60_000, 3);

      cache.set("a", "1", cfg);
      cache.set("b", "2", cfg);
      cache.set("c", "3", cfg);

      // Access "a" to move it to end
      cache.get("a", cfg);

      // Now insertion order is: b, c, a
      // Adding "d" should evict "b" (oldest)
      cache.set("d", "4", cfg);

      expect(cache.get("b", cfg)).toBeUndefined();
      expect(cache.get("a", cfg)).toBe("1");
      expect(cache.get("c", cfg)).toBe("3");
      expect(cache.get("d", cfg)).toBe("4");
    });
  });
});
