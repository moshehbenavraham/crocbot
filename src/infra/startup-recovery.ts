/**
 * Startup recovery logic for cron and heartbeat systems.
 *
 * When the gateway starts (or wakes from WSL sleep), this module:
 * 1. Detects overdue cron jobs by comparing persisted nextRunAtMs with the current time.
 * 2. Builds a human-readable "back online" report listing missed/recovered tasks.
 * 3. Sends the report to the configured Telegram user.
 *
 * The cron system already runs overdue jobs immediately on startup (any job
 * where nextRunAtMs <= now fires in runDueJobs). This module adds *visibility*
 * so the user knows what was missed and what is being caught up.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { loadCronStore, resolveCronStorePath } from "../cron/store.js";
import type { CronJob } from "../cron/types.js";
import { resolveStateDir } from "../config/paths.js";
import { sendMessageTelegram } from "../telegram/send.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("gateway/startup-recovery");

// Persisted timestamp of last known alive time
const LAST_ALIVE_FILENAME = "last-alive.json";

type LastAliveState = {
  version: 1;
  timestampMs: number;
};

type MissedCronJob = {
  id: string;
  name: string;
  scheduledAtMs: number;
  lastRunAtMs?: number;
  scheduleKind: string;
  willRunNow: boolean;
};

export type RecoveryReport = {
  wasOffline: boolean;
  offlineDurationMs: number;
  lastAliveMs: number | null;
  missedCronJobs: MissedCronJob[];
  stuckJobsCleared: number;
};

// ── Last-alive heartbeat ─────────────────────────────────────────────

function getLastAlivePath(): string {
  return path.join(resolveStateDir(), LAST_ALIVE_FILENAME);
}

/** Write the current timestamp to mark the gateway as alive. */
export async function persistLastAlive(): Promise<void> {
  const filePath = getLastAlivePath();
  const state: LastAliveState = { version: 1, timestampMs: Date.now() };
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state), "utf-8");
  } catch {
    // best-effort
  }
}

/** Read the last-alive timestamp. Returns null if no state exists. */
export async function readLastAlive(): Promise<number | null> {
  try {
    const raw = await fs.readFile(getLastAlivePath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<LastAliveState>;
    if (typeof parsed?.timestampMs === "number" && parsed.timestampMs > 0) {
      return parsed.timestampMs;
    }
  } catch {
    // missing or corrupt – treat as first boot
  }
  return null;
}

// ── Recovery detection ───────────────────────────────────────────────

const STUCK_RUN_MS = 2 * 60 * 60 * 1000; // same threshold as cron/service/jobs.ts

/**
 * Analyse cron store to find jobs that were missed while the gateway was
 * offline. A job is considered "missed" if:
 * - It is enabled and has a nextRunAtMs in the past
 * - Its lastRunAtMs is older than its nextRunAtMs (i.e. it didn't already run)
 *
 * Also counts stuck jobs whose runningAtMs marker was stale.
 */
export function detectMissedJobs(
  jobs: CronJob[],
  nowMs: number,
  _lastAliveMs: number | null,
): { missed: MissedCronJob[]; stuckCleared: number } {
  const missed: MissedCronJob[] = [];
  let stuckCleared = 0;

  for (const job of jobs) {
    if (!job.enabled) {
      continue;
    }

    // Count stuck jobs (runningAtMs older than threshold)
    if (typeof job.state.runningAtMs === "number") {
      if (nowMs - job.state.runningAtMs > STUCK_RUN_MS) {
        stuckCleared++;
      }
    }

    const next = job.state.nextRunAtMs;
    if (typeof next !== "number") {
      continue;
    }

    // Job is overdue
    if (next <= nowMs) {
      // Only report as missed if it was due *before* we came online
      // and hasn't already been run (lastRunAtMs is before the scheduled time)
      const lastRun = job.state.lastRunAtMs;
      const wasMissed = typeof lastRun !== "number" || lastRun < next;

      if (wasMissed) {
        missed.push({
          id: job.id,
          name: job.name,
          scheduledAtMs: next,
          lastRunAtMs: lastRun,
          scheduleKind: job.schedule.kind,
          willRunNow: true, // cron service will pick it up immediately
        });
      }
    }
  }

  // Sort by scheduled time (most overdue first)
  missed.sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);
  return { missed, stuckCleared };
}

// ── Recovery report builder ──────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 60_000) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms < 3_600_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.round((ms % 3_600_000) / 60_000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  });
}

export function buildRecoveryMessage(report: RecoveryReport): string | null {
  // Nothing to report
  if (!report.wasOffline && report.missedCronJobs.length === 0 && report.stuckJobsCleared === 0) {
    return null;
  }

  const parts: string[] = [];

  // Header
  parts.push("**I'm back online.**");

  if (report.offlineDurationMs > 0) {
    parts.push(`Offline for ~${formatDuration(report.offlineDurationMs)}.`);
  }

  // Missed cron jobs
  if (report.missedCronJobs.length > 0) {
    parts.push("");
    parts.push(`**Missed cron jobs** (${report.missedCronJobs.length}):`);
    const shown = report.missedCronJobs.slice(0, 8);
    for (const job of shown) {
      const overdueMs = Date.now() - job.scheduledAtMs;
      const overdueStr = formatDuration(overdueMs);
      const action = job.willRunNow ? "running now" : "skipped";
      parts.push(
        `- **${job.name}** (was due ${formatTime(job.scheduledAtMs)}, ${overdueStr} ago) - ${action}`,
      );
    }
    if (report.missedCronJobs.length > 8) {
      parts.push(`- ...and ${report.missedCronJobs.length - 8} more`);
    }
  }

  // Stuck jobs
  if (report.stuckJobsCleared > 0) {
    parts.push("");
    parts.push(
      `**Stuck jobs cleared:** ${report.stuckJobsCleared} job(s) had stale running markers and were reset.`,
    );
  }

  // Footer
  if (report.missedCronJobs.length > 0) {
    parts.push("");
    parts.push("_Overdue jobs will execute automatically as the cron scheduler catches up._");
  }

  return parts.join("\n");
}

// ── Main entry point ─────────────────────────────────────────────────

/**
 * Called during gateway startup to detect and report missed cron jobs.
 *
 * @param cronStorePath - path to cron jobs.json
 * @param userId - Telegram user ID for the report
 * @param minOfflineMs - minimum gap to consider as "offline" (default 2 min)
 */
export async function runStartupRecovery(params: {
  cronStorePath?: string;
  userId: string;
  minOfflineMs?: number;
}): Promise<RecoveryReport> {
  const { userId, minOfflineMs = 2 * 60_000 } = params;
  const nowMs = Date.now();

  // Read last-alive
  const lastAliveMs = await readLastAlive();

  // Persist current timestamp immediately (for future runs)
  await persistLastAlive();

  const offlineDurationMs = lastAliveMs !== null ? Math.max(0, nowMs - lastAliveMs) : 0;
  const wasOffline = offlineDurationMs >= minOfflineMs;

  // Read cron store (snapshot; cron service hasn't started yet or just started)
  const storePath = params.cronStorePath ?? resolveCronStorePath();
  let jobs: CronJob[] = [];
  try {
    const store = await loadCronStore(storePath);
    jobs = store.jobs;
  } catch (err) {
    log.warn(`startup recovery: failed to load cron store: ${String(err)}`);
  }

  const { missed, stuckCleared } = detectMissedJobs(jobs, nowMs, lastAliveMs);

  const report: RecoveryReport = {
    wasOffline,
    offlineDurationMs,
    lastAliveMs,
    missedCronJobs: missed,
    stuckJobsCleared: stuckCleared,
  };

  // Only send a message if there's something noteworthy
  const message = buildRecoveryMessage(report);
  if (message && userId) {
    try {
      await sendMessageTelegram(userId, message, { textMode: "markdown" });
      log.info("startup recovery report sent", {
        offlineDuration: formatDuration(offlineDurationMs),
        missedJobs: missed.length,
        stuckCleared,
      });
    } catch (err) {
      log.warn(`startup recovery: failed to send report: ${String(err)}`);
    }
  } else {
    log.info("startup recovery: clean startup, no recovery report needed");
  }

  return report;
}

// ── Periodic alive tick ──────────────────────────────────────────────

let aliveInterval: NodeJS.Timeout | null = null;

/**
 * Start a periodic timer that writes the last-alive timestamp every 60s.
 * This allows detection of WSL suspend / unexpected shutdown.
 */
export function startAliveHeartbeat(): void {
  // Write immediately on start
  void persistLastAlive();
  // Then every 60 seconds
  aliveInterval = setInterval(() => {
    void persistLastAlive();
  }, 60_000);
  aliveInterval.unref?.();
}

export function stopAliveHeartbeat(): void {
  if (aliveInterval) {
    clearInterval(aliveInterval);
    aliveInterval = null;
  }
}
