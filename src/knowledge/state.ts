import fs from "node:fs";
import path from "node:path";

import { ensureDir } from "../memory/internal.js";
import type { ImportState, ImportStateStatus, ImportStateStore } from "./types.js";

/** State file version for forward compatibility. */
const STATE_VERSION = 1;

/** Shape of the persisted JSON state file. */
interface PersistedState {
  version: number;
  sources: Record<string, ImportState>;
}

/** Create an empty persisted state structure. */
function emptyState(): PersistedState {
  return { version: STATE_VERSION, sources: {} };
}

/**
 * Read the state file from disk.
 * Returns an empty state if the file does not exist or is corrupt.
 */
export function readStateFile(filePath: string): PersistedState {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as PersistedState;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.version !== "number" ||
      typeof parsed.sources !== "object" ||
      parsed.sources === null
    ) {
      return emptyState();
    }
    return parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return emptyState();
    }
    // Corrupt file -- reset with warning
    process.stderr.write(`Warning: corrupt knowledge state file, resetting: ${filePath}\n`);
    return emptyState();
  }
}

/**
 * Write the state file atomically (write to temp then rename).
 * Ensures the parent directory exists.
 */
export function writeStateFile(filePath: string, state: PersistedState): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);

  const tmpPath = `${filePath}.tmp.${process.pid}`;
  const content = JSON.stringify(state, null, 2);

  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * Resolve the knowledge state file path for a given memory directory.
 * The state file lives alongside knowledge.db in the project's memory directory.
 */
export function resolveStatePath(memoryDir: string): string {
  return path.join(memoryDir, "knowledge-state.json");
}

/**
 * Create an ImportStateStore backed by a JSON file on disk.
 * Reads the file on construction and writes after every mutation.
 */
export function createFileStateStore(filePath: string): ImportStateStore {
  let persisted = readStateFile(filePath);

  const flush = (): void => {
    writeStateFile(filePath, persisted);
  };

  return {
    get(sourceValue: string): ImportState | null {
      return persisted.sources[sourceValue] ?? null;
    },

    list(filter?: { status?: ImportStateStatus }): ImportState[] {
      const all = Object.values(persisted.sources);
      if (!filter?.status) {
        return all;
      }
      return all.filter((s) => s.status === filter.status);
    },

    upsert(state: ImportState): void {
      persisted.sources[state.sourceValue] = state;
      flush();
    },

    markRemoved(sourceValue: string): void {
      const existing = persisted.sources[sourceValue];
      if (existing) {
        existing.status = "removed";
        existing.chunkCount = 0;
        existing.chunkIds = [];
        flush();
      }
    },

    delete(sourceValue: string): void {
      delete persisted.sources[sourceValue];
      flush();
    },
  };
}
