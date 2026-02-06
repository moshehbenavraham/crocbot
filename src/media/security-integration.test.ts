import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertMediaPath } from "./store.js";

// ---------------------------------------------------------------------------
// Path traversal integration tests
// ---------------------------------------------------------------------------

describe("assertMediaPath: path traversal rejection", () => {
  let mediaRoot: string;

  beforeEach(async () => {
    mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), "media-sec-"));
  });

  afterEach(async () => {
    await fs.rm(mediaRoot, { recursive: true, force: true });
  });

  it("allows a valid subdirectory path", () => {
    const target = path.join(mediaRoot, "inbound", "file.jpg");
    expect(() => assertMediaPath(target, mediaRoot)).not.toThrow();
  });

  it("allows the media root itself", () => {
    expect(() => assertMediaPath(mediaRoot, mediaRoot)).not.toThrow();
  });

  it("rejects ../ path traversal", () => {
    const target = path.join(mediaRoot, "..", "etc", "passwd");
    expect(() => assertMediaPath(target, mediaRoot)).toThrow("Path escapes media root");
  });

  it("rejects ../../ deep traversal", () => {
    const target = path.join(mediaRoot, "sub", "..", "..", "secret");
    expect(() => assertMediaPath(target, mediaRoot)).toThrow("Path escapes media root");
  });

  it("rejects absolute path outside media root", () => {
    expect(() => assertMediaPath("/etc/passwd", mediaRoot)).toThrow("Path escapes media root");
  });

  it("rejects absolute path to /tmp outside media root", () => {
    expect(() => assertMediaPath("/tmp/evil.txt", mediaRoot)).toThrow("Path escapes media root");
  });

  // Double-encoding edge case: %252e%252e decodes to %2e%2e in the
  // filesystem, which path.resolve treats literally (not as traversal).
  // However if a layer decodes it twice, it becomes ../. We verify that
  // assertMediaPath operates on the resolved path, so even if someone
  // crafts a directory literally named "%2e%2e", it stays within root.
  it("handles double-encoded traversal literals safely", () => {
    // path.resolve treats "%2e%2e" as a literal directory name, not traversal
    const target = path.join(mediaRoot, "%2e%2e", "file.txt");
    // This stays within the media root because %2e%2e is literal
    expect(() => assertMediaPath(target, mediaRoot)).not.toThrow();
  });

  it("rejects traversal with mixed separators", () => {
    // On POSIX, path.resolve normalizes forward slashes
    const target = path.resolve(mediaRoot, "../escape");
    expect(() => assertMediaPath(target, mediaRoot)).toThrow("Path escapes media root");
  });
});

// ---------------------------------------------------------------------------
// Null byte injection and Unicode normalization
// ---------------------------------------------------------------------------

describe("assertMediaPath: null byte and Unicode edge cases", () => {
  let mediaRoot: string;

  beforeEach(async () => {
    mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), "media-null-"));
  });

  afterEach(async () => {
    await fs.rm(mediaRoot, { recursive: true, force: true });
  });

  it("handles filename with embedded null byte safely", () => {
    // Null bytes in filenames are handled by the OS / Node fs layer.
    // path.resolve treats them as part of the string. On Linux, null
    // bytes in paths cause ENOENT. We verify assertMediaPath itself
    // does not bypass due to null bytes.
    const target = path.join(mediaRoot, "file\x00.txt");
    // The resolved path still starts with mediaRoot, so no traversal
    expect(() => assertMediaPath(target, mediaRoot)).not.toThrow();
  });

  it("handles Unicode normalization (NFC vs NFD) within root", () => {
    // e-acute: U+00E9 (NFC) vs U+0065 U+0301 (NFD)
    const nfcName = path.join(mediaRoot, "caf\u00E9.jpg");
    const nfdName = path.join(mediaRoot, "cafe\u0301.jpg");
    // Both resolve within the media root
    expect(() => assertMediaPath(nfcName, mediaRoot)).not.toThrow();
    expect(() => assertMediaPath(nfdName, mediaRoot)).not.toThrow();
  });

  it("rejects traversal even with Unicode in path", () => {
    const target = path.join(mediaRoot, "\u00E9", "..", "..", "escape");
    expect(() => assertMediaPath(target, mediaRoot)).toThrow("Path escapes media root");
  });
});

// ---------------------------------------------------------------------------
// Download timeout AbortSignal verification
// ---------------------------------------------------------------------------

describe("download timeout: AbortSignal.timeout verification", () => {
  it("getTelegramFile passes AbortSignal.timeout to fetch", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const mockFetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, result: { file_id: "abc", file_path: "photos/test.jpg" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchFn;

    try {
      const { getTelegramFile } = await import("../telegram/download.js");
      await getTelegramFile("test-token", "file-123", 15_000);

      expect(timeoutSpy).toHaveBeenCalledWith(15_000);
      expect(mockFetchFn).toHaveBeenCalledTimes(1);
      const callArgs = mockFetchFn.mock.calls[0];
      expect(callArgs[1]).toHaveProperty("signal");
    } finally {
      globalThis.fetch = originalFetch;
      timeoutSpy.mockRestore();
    }
  });

  it("downloadTelegramFile passes AbortSignal.timeout to fetch", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const mockFetchFn = vi.fn(
      async () =>
        new Response(Buffer.from("fake-image-data"), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchFn;

    // Mock saveMediaBuffer to avoid filesystem side effects
    vi.doMock("../media/store.js", () => ({
      saveMediaBuffer: vi.fn(async () => ({
        id: "test-id.jpg",
        path: "/tmp/test-id.jpg",
        size: 15,
        contentType: "image/jpeg",
      })),
    }));

    try {
      const { downloadTelegramFile } = await import("../telegram/download.js");
      await downloadTelegramFile(
        "test-token",
        { file_id: "abc", file_path: "photos/test.jpg" },
        undefined,
        45_000,
      );

      expect(timeoutSpy).toHaveBeenCalledWith(45_000);
    } finally {
      globalThis.fetch = originalFetch;
      timeoutSpy.mockRestore();
      vi.doUnmock("../media/store.js");
    }
  });

  it("AbortSignal.timeout default is 30s for getTelegramFile", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const mockFetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, result: { file_id: "abc", file_path: "photos/test.jpg" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchFn;

    try {
      const { getTelegramFile } = await import("../telegram/download.js");
      await getTelegramFile("test-token", "file-123");

      expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    } finally {
      globalThis.fetch = originalFetch;
      timeoutSpy.mockRestore();
    }
  });
});
