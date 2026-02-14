import { Cron } from "croner";
import type { CronSchedule } from "./types.js";

export function computeNextRunAtMs(schedule: CronSchedule, nowMs: number): number | undefined {
  if (schedule.kind === "at") {
    return schedule.atMs > nowMs ? schedule.atMs : undefined;
  }

  if (schedule.kind === "every") {
    const everyMs = Math.max(1, Math.floor(schedule.everyMs));
    const anchor = Math.max(0, Math.floor(schedule.anchorMs ?? nowMs));
    if (nowMs < anchor) {
      return anchor;
    }
    const elapsed = nowMs - anchor;
    const steps = Math.max(1, Math.floor((elapsed + everyMs - 1) / everyMs));
    return anchor + steps * everyMs;
  }

  const expr = schedule.expr.trim();
  if (!expr) {
    return undefined;
  }
  const cron = new Cron(expr, {
    timezone: schedule.tz?.trim() || undefined,
    catch: false,
  });
  // Cron operates at second granularity, so floor nowMs to the start of the
  // current second.  We ask croner for the next occurrence strictly *after*
  // nowSecondMs so that a job whose schedule matches the current second is
  // never re-scheduled into the same (already-elapsed) second.
  const nowSecondMs = Math.floor(nowMs / 1000) * 1000;
  const next = cron.nextRun(new Date(nowSecondMs));
  if (!next) {
    return undefined;
  }
  const nextMs = next.getTime();
  return Number.isFinite(nextMs) && nextMs > nowSecondMs ? nextMs : undefined;
}
