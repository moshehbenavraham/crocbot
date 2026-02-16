/**
 * Auto-memorize hook: extracts solutions, fragments, and instruments from
 * completed conversation transcripts using the utility model.
 *
 * Fires asynchronously at session end (fire-and-forget). Each extraction
 * type runs independently via Promise.allSettled so partial failures do
 * not block other categories.
 *
 * @see docs/adr/0007-memory-consolidation-architecture.md
 */

import type { TaskType } from "../agents/task-classifier.js";
import type { AutoMemorizeConfig } from "../config/types.agent-defaults.js";
import type { SubsystemLogger } from "../logging/subsystem.js";
import type { MemoryArea } from "./consolidation-actions.js";
import { EXTRACTION_PROMPTS, type ExtractionType } from "./auto-memorize-prompts.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_TRANSCRIPT_CHARS = 12_000;
const DEFAULT_EXTRACTION_TIMEOUT_MS = 30_000;
const EXTRACTION_TASK_TYPE: TaskType = "consolidation";

// ---------------------------------------------------------------------------
// Dependency injection
// ---------------------------------------------------------------------------

/** Callback to invoke the utility model. */
export type CallLlmFn = (params: {
  systemPrompt: string;
  userPrompt: string;
  taskType: TaskType;
  signal?: AbortSignal;
}) => Promise<string>;

/** Callback to embed text into a vector. */
export type EmbedTextFn = (text: string) => Promise<number[]>;

/** Callback to store an extracted chunk and trigger consolidation. */
export type StoreExtractedChunkFn = (params: {
  text: string;
  embedding: number[];
  area: MemoryArea;
  importance: number;
}) => Promise<void>;

/** Callback to check if the utility model budget is available. */
export type CheckBudgetFn = () => boolean;

/** Callback to read the session transcript text. */
export type GetTranscriptFn = (sessionId: string) => Promise<string>;

export interface AutoMemorizeDeps {
  callLlm: CallLlmFn;
  embedText: EmbedTextFn;
  storeExtractedChunk: StoreExtractedChunkFn;
  checkBudget: CheckBudgetFn;
  getTranscript: GetTranscriptFn;
  log: SubsystemLogger;
}

// ---------------------------------------------------------------------------
// Extraction result types
// ---------------------------------------------------------------------------

export interface SolutionExtraction {
  problem: string;
  solution: string;
  context?: string;
  importance: number;
}

export interface FragmentExtraction {
  fact: string;
  category: string;
  importance: number;
}

export interface InstrumentExtraction {
  name: string;
  description: string;
  type: string;
  importance: number;
}

export type ExtractionItem = SolutionExtraction | FragmentExtraction | InstrumentExtraction;

export interface ExtractionResult {
  type: ExtractionType;
  area: MemoryArea;
  items: ExtractionItem[];
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface AutoMemorizeResult {
  sessionId: string;
  results: ExtractionResult[];
  totalExtracted: number;
  totalStored: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Transcript parsing
// ---------------------------------------------------------------------------

interface TranscriptMessage {
  role: string;
  content: string;
}

/**
 * Parse a JSONL transcript into user/assistant message pairs.
 * Each line is expected to be a JSON object with `role` and `content` fields.
 * Non-user/assistant messages (e.g. system, tool) are filtered out.
 */
export function parseTranscript(raw: string): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "role" in parsed &&
        "content" in parsed
      ) {
        const obj = parsed as Record<string, unknown>;
        const role = String(obj["role"]);
        const rawContent = obj["content"];
        const content = typeof rawContent === "string" ? rawContent : "";
        if ((role === "user" || role === "assistant") && content.trim()) {
          messages.push({ role, content: content.trim() });
        }
      }
    } catch {
      // Skip malformed lines
    }
  }
  return messages;
}

/**
 * Build a transcript string from parsed messages, truncated to maxChars.
 */
export function buildTranscriptText(messages: TranscriptMessage[], maxChars: number): string {
  const parts: string[] = [];
  let totalChars = 0;
  for (const msg of messages) {
    const line = `${msg.role}: ${msg.content}`;
    if (totalChars + line.length > maxChars) {
      const remaining = maxChars - totalChars;
      if (remaining > 20) {
        parts.push(line.slice(0, remaining) + "...");
      }
      break;
    }
    parts.push(line);
    totalChars += line.length + 1; // +1 for newline
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Importance score validation
// ---------------------------------------------------------------------------

/** Clamp an importance score to the [0.0, 1.0] range. */
export function clampImportance(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, num));
}

// ---------------------------------------------------------------------------
// Extraction response parsing
// ---------------------------------------------------------------------------

/**
 * Parse a raw LLM JSON response into an array of extraction items.
 * Returns an empty array on malformed/empty responses.
 */
export function parseExtractionResponse(raw: string): unknown[] {
  const trimmed = raw.trim();
  // Strip markdown code fences if present
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

/** Convert a solution extraction raw object to typed form. */
export function parseSolutionItem(raw: unknown): SolutionExtraction | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const problem = typeof obj["problem"] === "string" ? obj["problem"].trim() : "";
  const solution = typeof obj["solution"] === "string" ? obj["solution"].trim() : "";
  if (!problem || !solution) {
    return null;
  }
  return {
    problem,
    solution,
    context: typeof obj["context"] === "string" ? obj["context"].trim() : undefined,
    importance: clampImportance(obj["importance"]),
  };
}

/** Convert a fragment extraction raw object to typed form. */
export function parseFragmentItem(raw: unknown): FragmentExtraction | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const fact = typeof obj["fact"] === "string" ? obj["fact"].trim() : "";
  if (!fact) {
    return null;
  }
  return {
    fact,
    category: typeof obj["category"] === "string" ? obj["category"].trim() : "fact",
    importance: clampImportance(obj["importance"]),
  };
}

/** Convert an instrument extraction raw object to typed form. */
export function parseInstrumentItem(raw: unknown): InstrumentExtraction | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const name = typeof obj["name"] === "string" ? obj["name"].trim() : "";
  const description = typeof obj["description"] === "string" ? obj["description"].trim() : "";
  if (!name || !description) {
    return null;
  }
  return {
    name,
    description,
    type: typeof obj["type"] === "string" ? obj["type"].trim() : "tool",
    importance: clampImportance(obj["importance"]),
  };
}

type ItemParser = (raw: unknown) => ExtractionItem | null;

const ITEM_PARSERS: Record<ExtractionType, ItemParser> = {
  solutions: parseSolutionItem,
  fragments: parseFragmentItem,
  instruments: parseInstrumentItem,
};

// ---------------------------------------------------------------------------
// Text builders for storage
// ---------------------------------------------------------------------------

function solutionToText(item: SolutionExtraction): string {
  let text = `Problem: ${item.problem}\nSolution: ${item.solution}`;
  if (item.context) {
    text += `\nContext: ${item.context}`;
  }
  return text;
}

function fragmentToText(item: FragmentExtraction): string {
  return `[${item.category}] ${item.fact}`;
}

function instrumentToText(item: InstrumentExtraction): string {
  return `[${item.type}] ${item.name}: ${item.description}`;
}

type TextBuilder = (item: ExtractionItem) => string;

const TEXT_BUILDERS: Record<ExtractionType, TextBuilder> = {
  solutions: (item) => solutionToText(item as SolutionExtraction),
  fragments: (item) => fragmentToText(item as FragmentExtraction),
  instruments: (item) => instrumentToText(item as InstrumentExtraction),
};

// ---------------------------------------------------------------------------
// Single extraction runner
// ---------------------------------------------------------------------------

/**
 * Run extraction for a single type (solutions, fragments, or instruments).
 * Returns parsed and validated extraction items.
 */
export async function runExtraction(
  type: ExtractionType,
  transcript: string,
  deps: Pick<AutoMemorizeDeps, "callLlm" | "checkBudget" | "log">,
  timeoutMs: number,
): Promise<ExtractionResult> {
  const promptSet = EXTRACTION_PROMPTS[type];
  const area = promptSet.area;

  // Check budget before calling LLM
  if (!deps.checkBudget()) {
    return {
      type,
      area,
      items: [],
      skipped: true,
      skipReason: "rate_limit",
    };
  }

  const userPrompt = promptSet.buildUserPrompt(transcript);
  const raw = await deps.callLlm({
    systemPrompt: promptSet.systemPrompt,
    userPrompt,
    taskType: EXTRACTION_TASK_TYPE,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const rawItems = parseExtractionResponse(raw);
  const parser = ITEM_PARSERS[type];
  const items: ExtractionItem[] = [];
  for (const rawItem of rawItems) {
    const parsed = parser(rawItem);
    if (parsed) {
      items.push(parsed);
    }
  }

  return { type, area, items, skipped: false };
}

// ---------------------------------------------------------------------------
// Storage integration
// ---------------------------------------------------------------------------

/**
 * Store extracted items: embed text, then store as categorized chunk with
 * area and importance, triggering consolidation.
 */
export async function storeExtractions(
  result: ExtractionResult,
  deps: Pick<AutoMemorizeDeps, "embedText" | "storeExtractedChunk" | "log">,
): Promise<number> {
  const textBuilder = TEXT_BUILDERS[result.type];
  let stored = 0;

  for (const item of result.items) {
    try {
      const text = textBuilder(item);
      const embedding = await deps.embedText(text);
      await deps.storeExtractedChunk({
        text,
        embedding,
        area: result.area,
        importance: (item as { importance: number }).importance,
      });
      stored++;
    } catch (err) {
      deps.log.warn(
        `auto-memorize: failed to store ${result.type} item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return stored;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Resolve config with defaults.
 */
export function resolveConfig(config: AutoMemorizeConfig | undefined): {
  enabled: boolean;
  maxTranscriptChars: number;
  extractionTimeoutMs: number;
} {
  return {
    enabled: config?.enabled ?? false,
    maxTranscriptChars: config?.maxTranscriptChars ?? DEFAULT_MAX_TRANSCRIPT_CHARS,
    extractionTimeoutMs: config?.extractionTimeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS,
  };
}

/**
 * Run the full auto-memorize pipeline for a completed session.
 *
 * 1. Check if enabled
 * 2. Read and parse transcript
 * 3. Run all 3 extraction types via Promise.allSettled
 * 4. Store extracted items
 * 5. Log results
 */
export async function runAutoMemorize(
  sessionId: string,
  config: AutoMemorizeConfig | undefined,
  deps: AutoMemorizeDeps,
): Promise<AutoMemorizeResult | null> {
  const resolved = resolveConfig(config);

  // Config-driven enable/disable (T014)
  if (!resolved.enabled) {
    deps.log.debug("auto-memorize: disabled by config");
    return null;
  }

  const startMs = Date.now();
  deps.log.info(`auto-memorize: starting extraction for session=${sessionId}`);

  // Read and parse transcript (T007)
  let transcriptText: string;
  try {
    const rawTranscript = await deps.getTranscript(sessionId);
    const messages = parseTranscript(rawTranscript);
    if (messages.length === 0) {
      deps.log.info("auto-memorize: empty transcript, skipping");
      return {
        sessionId,
        results: [],
        totalExtracted: 0,
        totalStored: 0,
        durationMs: Date.now() - startMs,
      };
    }
    transcriptText = buildTranscriptText(messages, resolved.maxTranscriptChars);
  } catch (err) {
    deps.log.warn(
      `auto-memorize: transcript read failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  // Run all 3 extraction types via Promise.allSettled (T012)
  const extractionTypes: ExtractionType[] = ["solutions", "fragments", "instruments"];
  const extractionPromises = extractionTypes.map((type) =>
    runExtraction(type, transcriptText, deps, resolved.extractionTimeoutMs),
  );
  const settled = await Promise.allSettled(extractionPromises);

  const results: ExtractionResult[] = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const type = extractionTypes[i];
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      const errMsg =
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      results.push({
        type,
        area: EXTRACTION_PROMPTS[type].area,
        items: [],
        skipped: false,
        error: errMsg,
      });
      deps.log.warn(`auto-memorize: ${type} extraction failed: ${errMsg}`);
    }
  }

  // Store extracted items (T010)
  let totalStored = 0;
  for (const result of results) {
    if (result.items.length > 0) {
      const stored = await storeExtractions(result, deps);
      totalStored += stored;
    }
  }

  const totalExtracted = results.reduce((sum, r) => sum + r.items.length, 0);
  const durationMs = Date.now() - startMs;

  // Observability logging (T016)
  const counts = results.map((r) => `${r.type}=${r.items.length}`).join(", ");
  const skips = results
    .filter((r) => r.skipped)
    .map((r) => `${r.type}(${r.skipReason})`)
    .join(", ");
  const errors = results
    .filter((r) => r.error)
    .map((r) => r.type)
    .join(", ");

  deps.log.info(
    `auto-memorize: complete session=${sessionId} extracted=${totalExtracted} stored=${totalStored} ` +
      `duration=${durationMs}ms counts=[${counts}]` +
      (skips ? ` skipped=[${skips}]` : "") +
      (errors ? ` errors=[${errors}]` : ""),
  );

  return {
    sessionId,
    results,
    totalExtracted,
    totalStored,
    durationMs,
  };
}
