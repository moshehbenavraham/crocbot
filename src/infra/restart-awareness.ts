import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { loadConfig } from "../config/config.js";
import { sendMessageTelegram } from "../telegram/send.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  listRunningSessions,
  listFinishedSessions,
  type ProcessSession,
  type FinishedSession,
} from "../agents/bash-process-registry.js";

const log = createSubsystemLogger("gateway/restart-awareness");

// File paths for restart state persistence
const STATE_FILENAME = "restart-state.json";

type RestartStateEntry = {
  id: string;
  command: string;
  status: "running" | "completed" | "failed" | "killed";
  startedAt: number;
  endedAt?: number;
  exitCode?: number | null;
  tail?: string;
};

type RestartState = {
  version: 1;
  shutdownAt: number;
  reason: string;
  notificationSent: boolean;
  notifiedUserId?: string;
  pendingProcesses: RestartStateEntry[];
  finishedProcesses: RestartStateEntry[];
};

function getRestartStatePath(): string {
  return path.join(resolveStateDir(), STATE_FILENAME);
}

/**
 * Persists the current state before restart so it can be recovered on startup.
 * Records running/finished background processes.
 */
export async function persistRestartState(opts: {
  reason: string;
  notificationSent: boolean;
  notifiedUserId?: string;
}): Promise<void> {
  const { reason, notificationSent, notifiedUserId } = opts;

  const running = listRunningSessions();
  const finished = listFinishedSessions();

  const state: RestartState = {
    version: 1,
    shutdownAt: Date.now(),
    reason,
    notificationSent,
    notifiedUserId,
    pendingProcesses: running.map(
      (session: ProcessSession): RestartStateEntry => ({
        id: session.id,
        command: session.command,
        status: "running",
        startedAt: session.startedAt,
        tail: session.tail,
      }),
    ),
    finishedProcesses: finished.map(
      (session: FinishedSession): RestartStateEntry => ({
        id: session.id,
        command: session.command,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        exitCode: session.exitCode,
        tail: session.tail,
      }),
    ),
  };

  const statePath = getRestartStatePath();
  try {
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
    log.info(`restart state persisted to ${statePath}`);
  } catch (err) {
    log.warn(`failed to persist restart state: ${String(err)}`);
  }
}

/**
 * Reads and clears any persisted restart state.
 * Returns null if no state exists.
 */
export async function consumeRestartState(): Promise<RestartState | null> {
  const statePath = getRestartStatePath();
  try {
    const raw = await fs.readFile(statePath, "utf-8");
    const state = JSON.parse(raw) as RestartState;
    // Remove the state file after reading
    await fs.unlink(statePath).catch(() => {});
    return state;
  } catch {
    return null;
  }
}

/**
 * Peeks at restart state without consuming it.
 */
export async function peekRestartState(): Promise<RestartState | null> {
  const statePath = getRestartStatePath();
  try {
    const raw = await fs.readFile(statePath, "utf-8");
    return JSON.parse(raw) as RestartState;
  } catch {
    return null;
  }
}

/**
 * Sends a proactive Telegram notification before restart.
 * Returns true if notification was sent successfully.
 */
export async function sendPreRestartNotification(opts: {
  userId: string;
  reason: string;
  restartExpectedMs?: number | null;
}): Promise<boolean> {
  const { userId, reason, restartExpectedMs } = opts;
  const cfg = loadConfig();

  // Collect info about running/finished processes
  const running = listRunningSessions();
  const finished = listFinishedSessions();

  let message = `⚠️ **Gateway Restarting**\n\nReason: ${reason}`;

  if (restartExpectedMs && restartExpectedMs > 0) {
    const seconds = Math.ceil(restartExpectedMs / 1000);
    message += `\nExpected downtime: ~${seconds}s`;
  }

  if (running.length > 0) {
    message += `\n\n📋 **Pending Background Processes** (${running.length}):`;
    for (const session of running.slice(0, 5)) {
      const cmd = truncateCommand(session.command);
      message += `\n• \`${session.id}\`: ${cmd}`;
    }
    if (running.length > 5) {
      message += `\n• ... and ${running.length - 5} more`;
    }
  }

  if (finished.length > 0) {
    const recentFinished = finished
      .filter((s) => Date.now() - s.endedAt < 5 * 60 * 1000) // last 5 minutes
      .slice(0, 3);
    if (recentFinished.length > 0) {
      message += `\n\n✅ **Recently Completed** (last 5m):`;
      for (const session of recentFinished) {
        const status = session.status === "completed" ? "✓" : "✗";
        const cmd = truncateCommand(session.command);
        message += `\n${status} \`${session.id}\`: ${cmd}`;
      }
    }
  }

  message += `\n\n_I'll report any missed completions when I'm back online._`;

  try {
    await sendMessageTelegram(userId, message, {
      textMode: "markdown",
    });
    log.info(`pre-restart notification sent to user ${userId}`);
    return true;
  } catch (err) {
    log.warn(`failed to send pre-restart notification: ${String(err)}`);
    return false;
  }
}

/**
 * Called on startup to check for restart state and send post-restart report.
 */
export async function handlePostRestartReport(opts: { defaultUserId?: string }): Promise<void> {
  const state = await consumeRestartState();
  if (!state) {
    log.info("no restart state found - clean startup");
    return;
  }

  const userId = state.notifiedUserId ?? opts.defaultUserId;
  if (!userId) {
    log.warn("restart state found but no user ID to notify");
    return;
  }

  const downtimeSec = Math.round((Date.now() - state.shutdownAt) / 1000);

  let message = `✅ **Gateway Back Online**\n\nDowntime: ${downtimeSec}s`;

  // Report on processes that were running during shutdown
  if (state.pendingProcesses.length > 0) {
    message += `\n\n⚠️ **Processes Interrupted by Restart** (${state.pendingProcesses.length}):`;
    for (const proc of state.pendingProcesses.slice(0, 5)) {
      const cmd = truncateCommand(proc.command);
      message += `\n• \`${proc.id}\`: ${cmd}`;
    }
    if (state.pendingProcesses.length > 5) {
      message += `\n• ... and ${state.pendingProcesses.length - 5} more`;
    }
    message += `\n\n_These processes were terminated during the restart. You may need to re-run them._`;
  }

  // Report processes that completed right before shutdown
  if (state.finishedProcesses.length > 0) {
    const unnotified = state.finishedProcesses.filter(
      (p) => p.status === "completed" || p.status === "failed",
    );
    if (unnotified.length > 0) {
      message += `\n\n📋 **Completed Before Shutdown** (${unnotified.length}):`;
      for (const proc of unnotified.slice(0, 3)) {
        const status = proc.status === "completed" ? "✓" : "✗";
        const cmd = truncateCommand(proc.command);
        const exitInfo = proc.exitCode != null ? ` (exit ${proc.exitCode})` : "";
        message += `\n${status} \`${proc.id}\`: ${cmd}${exitInfo}`;
      }
      if (unnotified.length > 3) {
        message += `\n• ... and ${unnotified.length - 3} more`;
      }
    }
  }

  if (
    state.pendingProcesses.length === 0 &&
    state.finishedProcesses.length === 0 &&
    state.notificationSent
  ) {
    // Simple recovery message if user was already notified
    message = `✅ **Gateway Back Online**\n\nDowntime: ${downtimeSec}s\nNo pending processes to report.`;
  }

  try {
    await sendMessageTelegram(userId, message, {
      textMode: "markdown",
    });
    log.info(`post-restart report sent to user ${userId}`);
  } catch (err) {
    log.warn(`failed to send post-restart report: ${String(err)}`);
  }
}

function truncateCommand(cmd: string, maxLen = 50): string {
  const cleaned = cmd.replace(/\n/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + "...";
}

// Export for testing
export const __testing = {
  getRestartStatePath,
};
