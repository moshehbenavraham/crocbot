import fs from "node:fs";
import path from "node:path";

import type { Command } from "commander";

import { resolveAgentDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { isDefaultProject, resolveProjectPaths } from "../agents/project-scope.js";
import { loadConfig } from "../config/config.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import { actionLabel, applyIncremental, classifySource } from "../knowledge/incremental.js";
import { createDefaultParserRegistry } from "../knowledge/parsers/index.js";
import { createDefaultDeps } from "../knowledge/pipeline.js";
import { importDocument } from "../knowledge/pipeline.js";
import { createFileStateStore, resolveStatePath } from "../knowledge/state.js";
import { resolveKnowledgeDbPath } from "../knowledge/storage.js";
import type {
  ImportPipelineOptions,
  ImportResult,
  ImportSource,
  ImportState,
  KnowledgeCategory,
  ParsedDocument,
} from "../knowledge/types.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { colorize, isRich, theme } from "../terminal/theme.js";
import { formatErrorMessage } from "./cli-utils.js";
import { withProgress } from "./progress.js";

// -- Types --

type KnowledgeImportOptions = {
  project?: string;
  category?: string;
  dryRun?: boolean;
  force?: boolean;
  batch?: string;
};

// -- Helpers --

/** SSRF-guarded fetch wrapper for the URL parser. */
async function guardedFetch(url: string, init?: RequestInit): Promise<Response> {
  const result = await fetchWithSsrFGuard({ url, init });
  try {
    return result.response;
  } finally {
    await result.release();
  }
}

/** Classify a source string as URL or local file. */
function classifySourceType(value: string): ImportSource {
  if (/^https?:\/\//i.test(value)) {
    return { type: "url", value };
  }
  const resolved = path.resolve(value);
  return { type: "file", value: resolved };
}

/** Read a local file into a Buffer. */
function readLocalFile(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

/** Detect parser hints from a file path. */
function fileHints(filePath: string): { extension?: string } {
  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  return ext ? { extension: ext } : {};
}

/** Resolve the memory directory for the target project scope. */
function resolveMemoryDir(
  cfg: ReturnType<typeof loadConfig>,
  agentId: string,
  projectId?: string,
): string {
  if (projectId && !isDefaultProject(projectId)) {
    const paths = resolveProjectPaths(cfg, agentId, projectId);
    return paths.memoryDir;
  }
  return resolveAgentDir(cfg, agentId);
}

/** Format a timestamp for display. */
function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString();
  } catch {
    return iso;
  }
}

// -- Import command implementation --

async function parseSource(source: ImportSource): Promise<ParsedDocument> {
  const registry = createDefaultParserRegistry({ fetch: guardedFetch });

  if (source.type === "file") {
    const raw = readLocalFile(source.value);
    const hints = fileHints(source.value);
    const parser = registry.resolve(source, hints);
    if (!parser) {
      throw new Error(`No parser found for file: ${source.value}`);
    }
    return parser.parse(source, raw, hints);
  }

  // URL source -- the URL parser handles fetching internally
  const parser = registry.resolve(source);
  if (!parser) {
    throw new Error(`No parser found for URL: ${source.value}`);
  }
  return parser.parse(source, Buffer.alloc(0));
}

async function importSingleSource(
  sourceValue: string,
  opts: KnowledgeImportOptions,
  cfg: ReturnType<typeof loadConfig>,
  agentId: string,
): Promise<ImportResult | null> {
  const rich = isRich();
  const source = classifySourceType(sourceValue);
  const memoryDir = resolveMemoryDir(cfg, agentId, opts.project);
  const category = (opts.category ?? "docs") as KnowledgeCategory;

  // Parse the document
  let doc: ParsedDocument;
  try {
    doc = await withProgress({ label: `Fetching ${source.value}...` }, async () =>
      parseSource(source),
    );
  } catch (err) {
    const message = formatErrorMessage(err);
    defaultRuntime.error(`Failed to parse ${source.value}: ${message}`);
    return {
      source,
      status: "failed",
      chunksStored: 0,
      chunksSkipped: 0,
      contentHash: "",
      durationMs: 0,
      error: message,
    };
  }

  // Incremental check
  const stateStore = createFileStateStore(resolveStatePath(memoryDir));
  const incremental = classifySource(doc, stateStore);

  defaultRuntime.log(
    `  ${colorize(rich, theme.muted, "Status:")} ${colorize(rich, theme.info, actionLabel(incremental.action))}`,
  );

  if (!opts.force && incremental.action === "unchanged") {
    defaultRuntime.log(`  ${colorize(rich, theme.muted, "Content unchanged, skipping.")}`);
    return {
      source,
      status: "unchanged",
      chunksStored: 0,
      chunksSkipped: incremental.previousChunkCount,
      contentHash: doc.contentHash,
      durationMs: 0,
    };
  }

  // Dry run
  if (opts.dryRun) {
    defaultRuntime.log(
      `  ${colorize(rich, theme.muted, "[dry-run] Would import")} ${doc.title} (${doc.content.length} chars)`,
    );
    return {
      source,
      status: "dry-run",
      chunksStored: 0,
      chunksSkipped: 0,
      contentHash: doc.contentHash,
      durationMs: 0,
    };
  }

  // Create pipeline deps
  let deps;
  try {
    deps = await createDefaultDeps({
      config: cfg,
      agentId,
      projectId: opts.project,
      category,
    });
  } catch (err) {
    const message = formatErrorMessage(err);
    defaultRuntime.error(`Failed to initialize pipeline: ${message}`);
    return {
      source,
      status: "failed",
      chunksStored: 0,
      chunksSkipped: 0,
      contentHash: doc.contentHash,
      durationMs: 0,
      error: message,
    };
  }

  try {
    // Apply incremental (remove old chunks if changed)
    applyIncremental(incremental, deps.storage);

    // Run import pipeline
    const pipelineOpts: ImportPipelineOptions = {
      source,
      agentId,
      projectId: opts.project,
      force: opts.force,
      dryRun: false,
    };

    const result = await withProgress({ label: `Importing ${doc.title}...` }, async (progress) => {
      const pipelineOptsWithProgress: ImportPipelineOptions = {
        ...pipelineOpts,
        onProgress: (update) => {
          progress.setLabel(`${update.stage}: ${update.completed}/${update.total}`);
        },
      };
      return importDocument(doc, pipelineOptsWithProgress, deps);
    });

    // Update state on success
    if (result.status === "imported") {
      const stateRecord: ImportState = {
        sourceValue: source.value,
        sourceType: source.type,
        contentHash: doc.contentHash,
        status: incremental.action === "new" ? "original" : "original",
        lastImportedAt: new Date().toISOString(),
        chunkCount: result.chunksStored,
        chunkIds: [],
        label: doc.title,
      };
      stateStore.upsert(stateRecord);
    }

    return result;
  } finally {
    deps.storage.close();
  }
}

// -- Batch import --

function readBatchFile(filePath: string): string[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Batch file not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

// -- CLI registration --

export function registerKnowledgeCli(program: Command): void {
  const knowledge = program
    .command("knowledge")
    .description("Knowledge base import and management")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/knowledge", "aiwithapex.mintlify.app/cli/knowledge")}\n`,
    );

  // -- import subcommand --
  knowledge
    .command("import")
    .description("Import a document into the knowledge base")
    .argument("[source]", "URL or local file path to import")
    .option("--project <name>", "Target project scope")
    .option("--category <category>", "Knowledge category (docs, references, solutions)", "docs")
    .option("--dry-run", "Preview what would be imported without side effects", false)
    .option("--force", "Force re-import even if content is unchanged", false)
    .option("--batch <file>", "Import multiple sources from a file (one per line)")
    .action(async (source: string | undefined, opts: KnowledgeImportOptions) => {
      const rich = isRich();
      const cfg = loadConfig();
      const agentId = resolveDefaultAgentId(cfg);

      // Validate category
      const validCategories = ["docs", "references", "solutions"];
      if (opts.category && !validCategories.includes(opts.category)) {
        defaultRuntime.error(
          `Invalid category "${opts.category}". Must be one of: ${validCategories.join(", ")}`,
        );
        process.exitCode = 1;
        return;
      }

      // Collect sources
      let sources: string[];
      if (opts.batch) {
        try {
          sources = readBatchFile(opts.batch);
        } catch (err) {
          defaultRuntime.error(formatErrorMessage(err));
          process.exitCode = 1;
          return;
        }
        if (sources.length === 0) {
          defaultRuntime.error("Batch file is empty or contains only comments.");
          process.exitCode = 1;
          return;
        }
      } else if (source) {
        sources = [source];
      } else {
        defaultRuntime.error("Provide a source URL/path or use --batch <file>.");
        process.exitCode = 1;
        return;
      }

      defaultRuntime.log(
        `${colorize(rich, theme.heading, "Knowledge Import")} ${colorize(rich, theme.muted, `(${sources.length} source${sources.length === 1 ? "" : "s"})`)}`,
      );
      if (opts.dryRun) {
        defaultRuntime.log(colorize(rich, theme.warn, "[dry-run mode]"));
      }
      defaultRuntime.log("");

      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const src of sources) {
        defaultRuntime.log(colorize(rich, theme.accent, src));
        try {
          const result = await importSingleSource(src, opts, cfg, agentId);
          if (!result) {
            failed += 1;
            continue;
          }

          switch (result.status) {
            case "imported":
              defaultRuntime.log(
                `  ${colorize(rich, theme.success, "Imported")} ${result.chunksStored} chunks (${result.chunksSkipped} skipped, ${result.durationMs}ms)`,
              );
              imported += 1;
              break;
            case "unchanged":
              skipped += 1;
              break;
            case "dry-run":
              skipped += 1;
              break;
            case "failed":
              defaultRuntime.log(
                `  ${colorize(rich, theme.warn, "Failed:")} ${result.error ?? "unknown error"}`,
              );
              failed += 1;
              break;
          }
        } catch (err) {
          defaultRuntime.error(`  ${formatErrorMessage(err)}`);
          failed += 1;
        }
        defaultRuntime.log("");
      }

      // Summary
      const summaryParts = [
        `${colorize(rich, theme.success, String(imported))} imported`,
        `${colorize(rich, theme.muted, String(skipped))} skipped`,
      ];
      if (failed > 0) {
        summaryParts.push(`${colorize(rich, theme.warn, String(failed))} failed`);
      }
      defaultRuntime.log(`Summary: ${summaryParts.join(", ")}`);

      if (failed > 0) {
        process.exitCode = 1;
      }
    });

  // -- list subcommand --
  knowledge
    .command("list")
    .description("List imported knowledge sources")
    .option("--project <name>", "Target project scope")
    .option("--json", "Output as JSON", false)
    .action(async (opts: { project?: string; json?: boolean }) => {
      const rich = isRich();
      const cfg = loadConfig();
      const agentId = resolveDefaultAgentId(cfg);
      const memoryDir = resolveMemoryDir(cfg, agentId, opts.project);
      const statePath = resolveStatePath(memoryDir);

      const stateStore = createFileStateStore(statePath);
      const sources = stateStore.list();

      if (opts.json) {
        defaultRuntime.log(JSON.stringify(sources, null, 2));
        return;
      }

      if (sources.length === 0) {
        defaultRuntime.log("No knowledge sources imported yet.");
        return;
      }

      defaultRuntime.log(
        `${colorize(rich, theme.heading, "Knowledge Sources")} ${colorize(rich, theme.muted, `(${sources.length})`)}`,
      );
      defaultRuntime.log("");

      for (const entry of sources) {
        const statusColor =
          entry.status === "removed"
            ? theme.warn
            : entry.status === "original"
              ? theme.success
              : theme.info;
        const lines = [
          `  ${colorize(rich, theme.accent, entry.sourceValue)}`,
          `    ${colorize(rich, theme.muted, "Type:")} ${entry.sourceType}`,
          `    ${colorize(rich, theme.muted, "Status:")} ${colorize(rich, statusColor, entry.status)}`,
          `    ${colorize(rich, theme.muted, "Chunks:")} ${entry.chunkCount}`,
          `    ${colorize(rich, theme.muted, "Imported:")} ${formatTimestamp(entry.lastImportedAt)}`,
        ];
        if (entry.label) {
          lines.splice(1, 0, `    ${colorize(rich, theme.muted, "Title:")} ${entry.label}`);
        }
        defaultRuntime.log(lines.join("\n"));
        defaultRuntime.log("");
      }
    });

  // -- remove subcommand --
  knowledge
    .command("remove")
    .description("Remove an imported knowledge source and its chunks")
    .argument("<source>", "Source URL or file path to remove")
    .option("--project <name>", "Target project scope")
    .action(async (source: string, opts: { project?: string }) => {
      const rich = isRich();
      const cfg = loadConfig();
      const agentId = resolveDefaultAgentId(cfg);
      const memoryDir = resolveMemoryDir(cfg, agentId, opts.project);

      // Normalize the source value (resolve file paths to absolute)
      const normalized = /^https?:\/\//i.test(source) ? source : path.resolve(source);

      const stateStore = createFileStateStore(resolveStatePath(memoryDir));
      const existing = stateStore.get(normalized);

      if (!existing) {
        defaultRuntime.log(
          `${colorize(rich, theme.muted, "Source not found in state:")} ${normalized}`,
        );
        return;
      }

      // Delete chunks from storage
      const dbPath = resolveKnowledgeDbPath(
        resolveAgentDir(cfg, agentId),
        opts.project && !isDefaultProject(opts.project)
          ? resolveProjectPaths(cfg, agentId, opts.project)
          : null,
      );

      try {
        // Dynamically import to avoid loading sqlite-vec when not needed
        const { openKnowledgeStorage } = await import("../knowledge/storage.js");
        const storage = openKnowledgeStorage(dbPath);
        try {
          const deleted = storage.deleteBySource(normalized);
          defaultRuntime.log(
            `${colorize(rich, theme.success, "Removed")} ${deleted} chunks for ${colorize(rich, theme.accent, normalized)}`,
          );
        } finally {
          storage.close();
        }
      } catch (err) {
        defaultRuntime.error(`Failed to remove chunks: ${formatErrorMessage(err)}`);
        // Still remove the state record even if chunk deletion fails
      }

      stateStore.delete(normalized);
      defaultRuntime.log(colorize(rich, theme.muted, "State record removed."));
    });
}
