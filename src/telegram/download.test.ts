import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadTelegramFile, getTelegramFile, type TelegramFileInfo } from "./download.js";

describe("telegram download", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("fetches file info", async () => {
    const json = vi.fn().mockResolvedValue({ ok: true, result: { file_path: "photos/1.jpg" } });
    vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json,
    } as Response);
    const info = await getTelegramFile("tok", "fid");
    expect(info.file_path).toBe("photos/1.jpg");
  });

  it("downloads and saves", async () => {
    const info: TelegramFileInfo = {
      file_id: "fid",
      file_path: "photos/1.jpg",
    };
    const arrayBuffer = async () => new Uint8Array([1, 2, 3, 4]).buffer;
    vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: true,
      arrayBuffer,
      headers: { get: () => "image/jpeg" },
    } as Response);
    const saved = await downloadTelegramFile("tok", info, 1024 * 1024);
    expect(saved.path).toBeTruthy();
    expect(saved.contentType).toBe("image/jpeg");
  });

  describe("timeout enforcement", () => {
    it("getTelegramFile passes signal to fetch", async () => {
      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ ok: true, result: { file_path: "photos/1.jpg" } }),
      } as Response);
      await getTelegramFile("tok", "fid");
      expect(fetchSpy).toHaveBeenCalledOnce();
      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs[1]).toHaveProperty("signal");
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });

    it("getTelegramFile uses default 30s timeout", async () => {
      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ ok: true, result: { file_path: "photos/1.jpg" } }),
      } as Response);
      await getTelegramFile("tok", "fid");
      const signal = fetchSpy.mock.calls[0][1].signal as AbortSignal;
      // Signal should not be already aborted at creation
      expect(signal.aborted).toBe(false);
    });

    it("getTelegramFile accepts custom timeoutMs", async () => {
      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ ok: true, result: { file_path: "photos/1.jpg" } }),
      } as Response);
      await getTelegramFile("tok", "fid", 5_000);
      const signal = fetchSpy.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
    });

    it("downloadTelegramFile passes signal to fetch", async () => {
      const info: TelegramFileInfo = {
        file_id: "fid",
        file_path: "photos/1.jpg",
      };
      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        body: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        headers: { get: () => "image/jpeg" },
      } as Response);
      await downloadTelegramFile("tok", info, 1024 * 1024);
      expect(fetchSpy).toHaveBeenCalledOnce();
      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs[1]).toHaveProperty("signal");
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });

    it("downloadTelegramFile accepts custom timeoutMs", async () => {
      const info: TelegramFileInfo = {
        file_id: "fid",
        file_path: "photos/1.jpg",
      };
      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        body: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        headers: { get: () => "image/jpeg" },
      } as Response);
      await downloadTelegramFile("tok", info, 1024 * 1024, 10_000);
      const signal = fetchSpy.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
    });
  });

  describe("originalFilename pass-through", () => {
    it("passes info.file_path as originalFilename to saveMediaBuffer", async () => {
      const info: TelegramFileInfo = {
        file_id: "fid",
        file_path: "photos/my_photo.jpg",
      };
      vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        body: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        headers: { get: () => "image/jpeg" },
      } as Response);
      const saved = await downloadTelegramFile("tok", info, 1024 * 1024);
      // The saved file should embed the original filename from file_path
      expect(saved.id).toContain("my_photo");
      expect(saved.id).toContain("---");
    });
  });
});
