import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CliBackendConfig } from "../config/types.js";
import { runCliAgent } from "./cli-runner.js";
import {
  cleanupSuspendedCliProcesses,
  registerOwnedPid,
  unregisterOwnedPid,
} from "./cli-runner/helpers.js";

const runCommandWithTimeoutMock = vi.fn();
const runExecMock = vi.fn();

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: (...args: unknown[]) => runCommandWithTimeoutMock(...args),
  runExec: (...args: unknown[]) => runExecMock(...args),
}));

describe("runCliAgent resume cleanup", () => {
  let killSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runCommandWithTimeoutMock.mockReset();
    runExecMock.mockReset();
    killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
    // Register PIDs that appear in ps output so they are "owned"
    registerOwnedPid(1);
  });

  afterEach(() => {
    killSpy.mockRestore();
    unregisterOwnedPid(1);
  });

  it("kills stale resume processes for codex sessions", async () => {
    // cleanupSuspendedCliProcesses calls ps; cleanupResumeProcesses also calls ps
    // Both now use process.kill() instead of runExec("pkill"/kill")
    registerOwnedPid(100);
    runExecMock
      .mockResolvedValueOnce({
        stdout: "  1 S /lib/systemd/systemd\n",
        stderr: "",
      }) // cleanupSuspendedCliProcesses (ps)
      .mockResolvedValueOnce({
        stdout:
          "  100 S codex exec resume thread-123 --color never --sandbox read-only --skip-git-repo-check\n",
        stderr: "",
      }); // cleanupResumeProcesses (ps)
    runCommandWithTimeoutMock.mockResolvedValueOnce({
      stdout: "ok",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    });

    await runCliAgent({
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      prompt: "hi",
      provider: "codex-cli",
      model: "gpt-5.2-codex",
      timeoutMs: 1_000,
      runId: "run-1",
      cliSessionId: "thread-123",
    });

    // ps called twice (suspended + resume), process.kill for matched owned PIDs
    expect(runExecMock).toHaveBeenCalledTimes(2);
    expect(runExecMock.mock.calls[0]?.[0]).toBe("ps");
    expect(runExecMock.mock.calls[1]?.[0]).toBe("ps");
    expect(killSpy).toHaveBeenCalledWith(100, "SIGTERM");
    unregisterOwnedPid(100);
  });
});

describe("cleanupSuspendedCliProcesses", () => {
  let killSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runExecMock.mockReset();
    killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
  });

  afterEach(() => {
    killSpy.mockRestore();
  });

  it("skips when no session tokens are configured", async () => {
    await cleanupSuspendedCliProcesses(
      {
        command: "tool",
      } as CliBackendConfig,
      0,
    );

    expect(runExecMock).not.toHaveBeenCalled();
  });

  it("matches sessionArg-based commands and kills owned PIDs", async () => {
    registerOwnedPid(40);
    runExecMock.mockResolvedValueOnce({
      stdout: [
        "  40 T+ claude --session-id thread-1 -p",
        "  41 S  claude --session-id thread-2 -p",
      ].join("\n"),
      stderr: "",
    });

    await cleanupSuspendedCliProcesses(
      {
        command: "claude",
        sessionArg: "--session-id",
      } as CliBackendConfig,
      0,
    );

    // Only ps call via runExec; killing via process.kill
    expect(runExecMock).toHaveBeenCalledTimes(1);
    expect(runExecMock.mock.calls[0]?.[0]).toBe("ps");
    // PID 40 is owned and T+ (suspended) so it gets SIGKILL
    expect(killSpy).toHaveBeenCalledWith(40, "SIGKILL");
    // PID 41 is not owned so it is not killed
    expect(killSpy).not.toHaveBeenCalledWith(41, expect.anything());
    unregisterOwnedPid(40);
  });

  it("matches resumeArgs with positional session id", async () => {
    registerOwnedPid(50);
    registerOwnedPid(51);
    runExecMock.mockResolvedValueOnce({
      stdout: [
        "  50 T  codex exec resume thread-99 --color never --sandbox read-only",
        "  51 T  codex exec resume other --color never --sandbox read-only",
      ].join("\n"),
      stderr: "",
    });

    await cleanupSuspendedCliProcesses(
      {
        command: "codex",
        resumeArgs: ["exec", "resume", "{sessionId}", "--color", "never", "--sandbox", "read-only"],
      } as CliBackendConfig,
      1,
    );

    // Only ps call via runExec
    expect(runExecMock).toHaveBeenCalledTimes(1);
    expect(runExecMock.mock.calls[0]?.[0]).toBe("ps");
    // Both PIDs are owned and suspended (T), and count (2) > threshold (1)
    expect(killSpy).toHaveBeenCalledWith(50, "SIGKILL");
    expect(killSpy).toHaveBeenCalledWith(51, "SIGKILL");
    unregisterOwnedPid(50);
    unregisterOwnedPid(51);
  });
});
