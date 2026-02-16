/**
 * CLI subcommands for reasoning trace management.
 *
 * - `crocbot reasoning traces` - List recent reasoning traces
 * - `crocbot reasoning traces export` - Export traces as JSON to stdout
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import os from "node:os";

import type { Command } from "commander";

import { ReasoningTraceStore } from "../agents/reasoning/trace-store.js";
import type { ReasoningTrace, TraceQueryOptions } from "../agents/reasoning/trace-store.js";
import { resolveStateDir } from "../config/paths.js";
import { colorize, isRich, theme } from "../terminal/theme.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import { defaultRuntime } from "../runtime.js";

function getDbPath(): string {
  const stateDir = resolveStateDir(process.env, os.homedir);
  return path.join(stateDir, "memory", "memory.sqlite");
}

function buildQueryOptions(opts: {
  session?: string;
  model?: string;
  since?: string;
  limit?: string;
}): TraceQueryOptions {
  const query: TraceQueryOptions = {};
  if (opts.session) {
    query.sessionKey = opts.session;
  }
  if (opts.model) {
    query.model = opts.model;
  }
  if (opts.since) {
    const ms = parseSinceFlag(opts.since);
    if (ms > 0) {
      query.since = ms;
    }
  }
  if (opts.limit) {
    const n = Number(opts.limit);
    if (Number.isFinite(n) && n > 0) {
      query.limit = n;
    }
  }
  return query;
}

function parseSinceFlag(value: string): number {
  // Support ISO date strings and relative durations like "1d", "12h", "30m".
  const relative = value.match(/^(\d+)([dhm])$/);
  if (relative) {
    const n = Number(relative[1]);
    const unit = relative[2];
    const multiplier = unit === "d" ? 86400000 : unit === "h" ? 3600000 : 60000;
    return Date.now() - n * multiplier;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTraceTable(traces: ReasoningTrace[]): string {
  if (traces.length === 0) {
    return "No traces found.";
  }

  const lines: string[] = [];
  const header = [
    "ID".padEnd(6),
    "Session".padEnd(20),
    "Model".padEnd(24),
    "Provider".padEnd(12),
    "Tokens".padEnd(8),
    "Created".padEnd(20),
  ].join("  ");

  lines.push(colorize(isRich(), theme.muted, header));
  lines.push("-".repeat(header.length));

  for (const t of traces) {
    const created = new Date(t.createdAt).toISOString().slice(0, 19).replace("T", " ");
    lines.push(
      [
        String(t.id).padEnd(6),
        t.sessionKey.slice(0, 20).padEnd(20),
        t.model.slice(0, 24).padEnd(24),
        t.provider.slice(0, 12).padEnd(12),
        String(t.reasoningTokens).padEnd(8),
        created.padEnd(20),
      ].join("  "),
    );
  }

  lines.push("");
  lines.push(`${traces.length} trace(s)`);
  return lines.join("\n");
}

export function registerReasoningCli(program: Command): void {
  const reasoning = program.command("reasoning").description("Reasoning model trace management");

  const traces = reasoning
    .command("traces")
    .description("List recent reasoning traces")
    .option("--session <key>", "Filter by session key")
    .option("--model <model>", "Filter by model name")
    .option("--since <when>", "Show traces since (ISO date or relative: 1d, 12h, 30m)")
    .option("--limit <n>", "Maximum number of traces to show", "50")
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const dbPath = getDbPath();
        const db = new DatabaseSync(dbPath);
        try {
          const store = new ReasoningTraceStore(db);
          const query = buildQueryOptions(
            opts as {
              session?: string;
              model?: string;
              since?: string;
              limit?: string;
            },
          );
          const results = store.query(query);
          process.stdout.write(formatTraceTable(results) + "\n");
        } finally {
          db.close();
        }
      });
    });

  traces
    .command("export")
    .description("Export reasoning traces as JSON to stdout")
    .option("--session <key>", "Filter by session key")
    .option("--model <model>", "Filter by model name")
    .option("--since <when>", "Show traces since (ISO date or relative: 1d, 12h, 30m)")
    .option("--limit <n>", "Maximum number of traces to export", "100")
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const dbPath = getDbPath();
        const db = new DatabaseSync(dbPath);
        try {
          const store = new ReasoningTraceStore(db);
          const query = buildQueryOptions(
            opts as {
              session?: string;
              model?: string;
              since?: string;
              limit?: string;
            },
          );
          const results = store.query(query);
          process.stdout.write(JSON.stringify(results, null, 2) + "\n");
        } finally {
          db.close();
        }
      });
    });
}
