import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.fn();

describe("cli credentials", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    execSyncMock.mockReset();
    delete process.env.CODEX_HOME;
    const { resetCliCredentialCachesForTest } = await import("./cli-credentials.js");
    resetCliCredentialCachesForTest();
  });

  it("keychain write is a no-op on Linux", async () => {
    const { writeClaudeCliKeychainCredentials } = await import("./cli-credentials.js");

    const ok = writeClaudeCliKeychainCredentials({
      access: "new-access",
      refresh: "new-refresh",
      expires: Date.now() + 60_000,
    });

    expect(ok).toBe(false);
  });

  it("writes credentials to the file store", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crocbot-"));
    const credPath = path.join(tempDir, ".claude", ".credentials.json");

    fs.mkdirSync(path.dirname(credPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      credPath,
      `${JSON.stringify(
        {
          claudeAiOauth: {
            accessToken: "old-access",
            refreshToken: "old-refresh",
            expiresAt: Date.now() + 60_000,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const { writeClaudeCliCredentials } = await import("./cli-credentials.js");

    const ok = writeClaudeCliCredentials(
      {
        access: "new-access",
        refresh: "new-refresh",
        expires: Date.now() + 120_000,
      },
      {
        homeDir: tempDir,
      },
    );

    expect(ok).toBe(true);

    const updated = JSON.parse(fs.readFileSync(credPath, "utf8")) as {
      claudeAiOauth?: {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
      };
    };

    expect(updated.claudeAiOauth?.accessToken).toBe("new-access");
    expect(updated.claudeAiOauth?.refreshToken).toBe("new-refresh");
    expect(updated.claudeAiOauth?.expiresAt).toBeTypeOf("number");
  });

  it("caches Claude Code CLI credentials within the TTL window", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crocbot-cache-"));
    const credPath = path.join(tempDir, ".claude", ".credentials.json");
    fs.mkdirSync(path.dirname(credPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      credPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "cached-access",
          refreshToken: "cached-refresh",
          expiresAt: Date.now() + 60_000,
        },
      }),
      "utf8",
    );

    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

    const { readClaudeCliCredentialsCached } = await import("./cli-credentials.js");

    const first = readClaudeCliCredentialsCached({
      ttlMs: 15 * 60 * 1000,
      homeDir: tempDir,
    });
    const second = readClaudeCliCredentialsCached({
      ttlMs: 15 * 60 * 1000,
      homeDir: tempDir,
    });

    expect(first).toBeTruthy();
    expect(second).toEqual(first);
  });

  it("refreshes Claude Code CLI credentials after the TTL window", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crocbot-refresh-"));
    const credPath = path.join(tempDir, ".claude", ".credentials.json");
    fs.mkdirSync(path.dirname(credPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      credPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "token-first",
          refreshToken: "refresh",
          expiresAt: Date.now() + 60_000,
        },
      }),
      "utf8",
    );

    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

    const { readClaudeCliCredentialsCached } = await import("./cli-credentials.js");

    const first = readClaudeCliCredentialsCached({
      ttlMs: 15 * 60 * 1000,
      homeDir: tempDir,
    });

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    // Update the file to simulate changed credentials
    fs.writeFileSync(
      credPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "token-second",
          refreshToken: "refresh",
          expiresAt: Date.now() + 60_000,
        },
      }),
      "utf8",
    );

    const second = readClaudeCliCredentialsCached({
      ttlMs: 15 * 60 * 1000,
      homeDir: tempDir,
    });

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  });

  it("returns null for Codex keychain credentials on Linux", async () => {
    const { readCodexCliCredentials } = await import("./cli-credentials.js");
    const creds = readCodexCliCredentials({ platform: "linux" });
    expect(creds).toBeNull();
  });

  it("reads Codex credentials from auth.json file", async () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "crocbot-codex-"));
    process.env.CODEX_HOME = tempHome;

    const authPath = path.join(tempHome, "auth.json");
    fs.mkdirSync(tempHome, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        tokens: {
          access_token: "file-access",
          refresh_token: "file-refresh",
        },
      }),
      "utf8",
    );

    const { readCodexCliCredentials } = await import("./cli-credentials.js");
    const creds = readCodexCliCredentials();

    expect(creds).toMatchObject({
      access: "file-access",
      refresh: "file-refresh",
      provider: "openai-codex",
    });
  });
});
