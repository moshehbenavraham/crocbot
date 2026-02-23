import type { ChannelDirectoryEntryKind, ChannelId } from "../../channels/plugins/types.js";
import type { crocbotConfig } from "../../config/config.js";

type CacheEntry<T> = {
  value: T;
  fetchedAt: number;
};

export type DirectoryCacheKey = {
  channel: ChannelId;
  accountId?: string | null;
  kind: ChannelDirectoryEntryKind;
  source: "cache" | "live";
  signature?: string | null;
};

export function buildDirectoryCacheKey(key: DirectoryCacheKey): string {
  const signature = key.signature ?? "default";
  return `${key.channel}:${key.accountId ?? "default"}:${key.kind}:${key.source}:${signature}`;
}

const DEFAULT_MAX_ENTRIES = 200;

export class DirectoryCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private lastConfigRef: crocbotConfig | null = null;
  private readonly maxSize: number;

  constructor(
    private readonly ttlMs: number,
    maxSize?: number,
  ) {
    this.maxSize = typeof maxSize === "number" && maxSize > 0 ? maxSize : DEFAULT_MAX_ENTRIES;
  }

  get(key: string, cfg: crocbotConfig): T | undefined {
    this.resetIfConfigChanged(cfg);
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end for LRU ordering
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, cfg: crocbotConfig): void {
    this.resetIfConfigChanged(cfg);
    // Delete first so re-inserts move to end (LRU ordering)
    this.cache.delete(key);
    // Evict oldest entries (first in insertion order) when at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next();
      if (oldest.done) {
        break;
      }
      this.cache.delete(oldest.value);
    }
    this.cache.set(key, { value, fetchedAt: Date.now() });
  }

  clearMatching(match: (key: string) => boolean): void {
    for (const key of this.cache.keys()) {
      if (match(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(cfg?: crocbotConfig): void {
    this.cache.clear();
    if (cfg) {
      this.lastConfigRef = cfg;
    }
  }

  private resetIfConfigChanged(cfg: crocbotConfig): void {
    if (this.lastConfigRef && this.lastConfigRef !== cfg) {
      this.cache.clear();
    }
    this.lastConfigRef = cfg;
  }
}
