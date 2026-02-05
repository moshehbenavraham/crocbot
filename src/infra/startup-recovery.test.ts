import { describe, it, expect } from "vitest";
import { detectMissedJobs, buildRecoveryMessage, type RecoveryReport } from "./startup-recovery.js";
import type { CronJob } from "../cron/types.js";

function makeCronJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "test-id",
    name: "Test Job",
    enabled: true,
    createdAtMs: 1000,
    updatedAtMs: 1000,
    schedule: { kind: "cron", expr: "0 8 * * *" },
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payload: { kind: "systemEvent", text: "test" },
    state: {},
    ...overrides,
  };
}

describe("detectMissedJobs", () => {
  const NOW = 1_700_000_000_000;

  it("detects an overdue job as missed", () => {
    const jobs = [
      makeCronJob({
        state: {
          nextRunAtMs: NOW - 3_600_000, // 1 hour ago
          lastRunAtMs: NOW - 7_200_000, // 2 hours ago (before scheduled)
        },
      }),
    ];
    const result = detectMissedJobs(jobs, NOW, NOW - 7_200_000);
    expect(result.missed).toHaveLength(1);
    expect(result.missed[0].name).toBe("Test Job");
    expect(result.missed[0].willRunNow).toBe(true);
  });

  it("ignores disabled jobs", () => {
    const jobs = [
      makeCronJob({
        enabled: false,
        state: { nextRunAtMs: NOW - 3_600_000 },
      }),
    ];
    const result = detectMissedJobs(jobs, NOW, null);
    expect(result.missed).toHaveLength(0);
  });

  it("ignores jobs already run after their scheduled time", () => {
    const jobs = [
      makeCronJob({
        state: {
          nextRunAtMs: NOW - 3_600_000,
          lastRunAtMs: NOW - 1_800_000, // ran after it was due
        },
      }),
    ];
    const result = detectMissedJobs(jobs, NOW, null);
    expect(result.missed).toHaveLength(0);
  });

  it("counts stuck jobs", () => {
    const STUCK_THRESHOLD = 2 * 60 * 60 * 1000;
    const jobs = [
      makeCronJob({
        state: {
          runningAtMs: NOW - STUCK_THRESHOLD - 1000,
        },
      }),
    ];
    const result = detectMissedJobs(jobs, NOW, null);
    expect(result.stuckCleared).toBe(1);
  });

  it("does not count recently-started jobs as stuck", () => {
    const jobs = [
      makeCronJob({
        state: {
          runningAtMs: NOW - 60_000, // 1 minute ago
        },
      }),
    ];
    const result = detectMissedJobs(jobs, NOW, null);
    expect(result.stuckCleared).toBe(0);
  });

  it("handles jobs with no nextRunAtMs", () => {
    const jobs = [makeCronJob({ state: {} })];
    const result = detectMissedJobs(jobs, NOW, null);
    expect(result.missed).toHaveLength(0);
  });
});

describe("buildRecoveryMessage", () => {
  it("returns null when nothing to report", () => {
    const report: RecoveryReport = {
      wasOffline: false,
      offlineDurationMs: 0,
      lastAliveMs: null,
      missedCronJobs: [],
      stuckJobsCleared: 0,
    };
    expect(buildRecoveryMessage(report)).toBeNull();
  });

  it("includes offline duration", () => {
    const report: RecoveryReport = {
      wasOffline: true,
      offlineDurationMs: 3_600_000,
      lastAliveMs: Date.now() - 3_600_000,
      missedCronJobs: [
        {
          id: "1",
          name: "Morning Check",
          scheduledAtMs: Date.now() - 1_800_000,
          scheduleKind: "cron",
          willRunNow: true,
        },
      ],
      stuckJobsCleared: 0,
    };
    const msg = buildRecoveryMessage(report)!;
    expect(msg).toContain("back online");
    expect(msg).toContain("1h");
    expect(msg).toContain("Morning Check");
    expect(msg).toContain("running now");
  });

  it("includes stuck job count", () => {
    const report: RecoveryReport = {
      wasOffline: true,
      offlineDurationMs: 7_200_000,
      lastAliveMs: Date.now() - 7_200_000,
      missedCronJobs: [],
      stuckJobsCleared: 2,
    };
    const msg = buildRecoveryMessage(report)!;
    expect(msg).toContain("Stuck jobs cleared");
    expect(msg).toContain("2 job(s)");
  });

  it("truncates long lists", () => {
    const report: RecoveryReport = {
      wasOffline: true,
      offlineDurationMs: 3_600_000,
      lastAliveMs: Date.now() - 3_600_000,
      missedCronJobs: Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        name: `Job ${i}`,
        scheduledAtMs: Date.now() - 1_800_000,
        scheduleKind: "cron",
        willRunNow: true,
      })),
      stuckJobsCleared: 0,
    };
    const msg = buildRecoveryMessage(report)!;
    expect(msg).toContain("...and 4 more");
  });
});
