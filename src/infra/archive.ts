import fs from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import JSZip from "jszip";

export type ArchiveKind = "tar" | "zip";

export type ArchiveLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

export type ArchiveResourceLimits = {
  maxFiles?: number;
  maxTotalBytes?: number;
  maxEntryBytes?: number;
};

const DEFAULT_MAX_FILES = 10_000;
const DEFAULT_MAX_TOTAL_BYTES = 1_073_741_824; // 1 GB
const DEFAULT_MAX_ENTRY_BYTES = 104_857_600; // 100 MB

const TAR_SUFFIXES = [".tgz", ".tar.gz", ".tar"];

function resolveLimits(limits?: ArchiveResourceLimits) {
  return {
    maxFiles: limits?.maxFiles ?? DEFAULT_MAX_FILES,
    maxTotalBytes: limits?.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
    maxEntryBytes: limits?.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES,
  };
}

function isPathContained(entryPath: string, destDir: string): boolean {
  const resolved = path.resolve(destDir, entryPath);
  return resolved === destDir || resolved.startsWith(destDir + path.sep);
}

function validateEntryPath(entryName: string, destDir: string): void {
  const normalized = entryName.replaceAll("\\", "/");
  if (normalized.includes("..")) {
    throw new Error(`archive entry contains path traversal: ${entryName}`);
  }
  if (path.isAbsolute(normalized)) {
    throw new Error(`archive entry has absolute path: ${entryName}`);
  }
  if (!isPathContained(normalized, destDir)) {
    throw new Error(`archive entry escapes destination: ${entryName}`);
  }
}

export function resolveArchiveKind(filePath: string): ArchiveKind | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".zip")) {
    return "zip";
  }
  if (TAR_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return "tar";
  }
  return null;
}

export async function resolvePackedRootDir(extractDir: string): Promise<string> {
  const direct = path.join(extractDir, "package");
  try {
    const stat = await fs.stat(direct);
    if (stat.isDirectory()) {
      return direct;
    }
  } catch {
    // ignore
  }

  const entries = await fs.readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (dirs.length !== 1) {
    throw new Error(`unexpected archive layout (dirs: ${dirs.join(", ")})`);
  }
  const onlyDir = dirs[0];
  if (!onlyDir) {
    throw new Error("unexpected archive layout (no package dir found)");
  }
  return path.join(extractDir, onlyDir);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function extractZip(params: {
  archivePath: string;
  destDir: string;
  limits: ReturnType<typeof resolveLimits>;
}): Promise<void> {
  const buffer = await fs.readFile(params.archivePath);
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);

  if (entries.length > params.limits.maxFiles) {
    throw new Error(
      `archive exceeds max file count: ${entries.length} > ${params.limits.maxFiles}`,
    );
  }

  let totalBytes = 0;

  for (const entry of entries) {
    const entryPath = entry.name.replaceAll("\\", "/");
    if (!entryPath || entryPath.endsWith("/")) {
      validateEntryPath(entryPath || ".", params.destDir);
      const dirPath = path.resolve(params.destDir, entryPath);
      await fs.mkdir(dirPath, { recursive: true });
      continue;
    }

    validateEntryPath(entryPath, params.destDir);

    const outPath = path.resolve(params.destDir, entryPath);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const data = await entry.async("nodebuffer");

    if (data.length > params.limits.maxEntryBytes) {
      throw new Error(
        `archive entry exceeds max size: ${entry.name} (${data.length} > ${params.limits.maxEntryBytes})`,
      );
    }
    totalBytes += data.length;
    if (totalBytes > params.limits.maxTotalBytes) {
      throw new Error(
        `archive exceeds max total size: ${totalBytes} > ${params.limits.maxTotalBytes}`,
      );
    }

    await fs.writeFile(outPath, data);
  }
}

async function extractTar(params: {
  archivePath: string;
  destDir: string;
  limits: ReturnType<typeof resolveLimits>;
}): Promise<void> {
  let fileCount = 0;
  let totalBytes = 0;

  await tar.x({
    file: params.archivePath,
    cwd: params.destDir,
    filter: (entryPath: string) => {
      const normalized = entryPath.replaceAll("\\", "/");
      if (normalized.includes("..") || path.isAbsolute(normalized)) {
        throw new Error(`tar entry contains path traversal: ${entryPath}`);
      }
      if (!isPathContained(normalized, params.destDir)) {
        throw new Error(`tar entry escapes destination: ${entryPath}`);
      }
      fileCount += 1;
      if (fileCount > params.limits.maxFiles) {
        throw new Error(`archive exceeds max file count: ${fileCount} > ${params.limits.maxFiles}`);
      }
      return true;
    },
    onentry: (entry) => {
      if (entry.size > params.limits.maxEntryBytes) {
        entry.abort(
          new Error(
            `tar entry exceeds max size: ${entry.path} (${entry.size} > ${params.limits.maxEntryBytes})`,
          ),
        );
        return;
      }
      totalBytes += entry.size;
      if (totalBytes > params.limits.maxTotalBytes) {
        entry.abort(
          new Error(
            `archive exceeds max total size: ${totalBytes} > ${params.limits.maxTotalBytes}`,
          ),
        );
      }
    },
  });
}

export async function extractArchive(params: {
  archivePath: string;
  destDir: string;
  timeoutMs: number;
  logger?: ArchiveLogger;
  limits?: ArchiveResourceLimits;
}): Promise<void> {
  const kind = resolveArchiveKind(params.archivePath);
  if (!kind) {
    throw new Error(`unsupported archive: ${params.archivePath}`);
  }

  const limits = resolveLimits(params.limits);
  const label = kind === "zip" ? "extract zip" : "extract tar";
  if (kind === "tar") {
    await withTimeout(
      extractTar({ archivePath: params.archivePath, destDir: params.destDir, limits }),
      params.timeoutMs,
      label,
    );
    return;
  }

  await withTimeout(
    extractZip({ archivePath: params.archivePath, destDir: params.destDir, limits }),
    params.timeoutMs,
    label,
  );
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}
