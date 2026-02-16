import type { AssistantMessageEvent } from "@mariozechner/pi-ai";

// ---------------------------------------------------------------------------
// ReasoningPhase -- lifecycle phase of a reasoning chunk
// ---------------------------------------------------------------------------

/** Lifecycle phase of a reasoning chunk within a single thinking block. */
export type ReasoningPhase = "start" | "delta" | "end";

// ---------------------------------------------------------------------------
// AdapterMeta -- provider-specific metadata bag
// ---------------------------------------------------------------------------

/** Provider-specific metadata attached to each reasoning chunk. */
export type AdapterMeta = Readonly<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// ReasoningChunk -- normalized reasoning event from any provider
// ---------------------------------------------------------------------------

/**
 * Normalized reasoning chunk produced by an adapter.
 * Adapters produce these; the accumulator and trace store consume them.
 */
export interface ReasoningChunk {
  /** Source provider identifier. */
  readonly provider: "openai" | "anthropic" | "deepseek" | "tag-fallback" | (string & {});

  /** Chunk lifecycle phase. */
  readonly phase: ReasoningPhase;

  /** Incremental reasoning text for this chunk (empty string for start/end). */
  readonly text: string;

  /** Content block index from the SDK event (for multi-block messages). */
  readonly contentIndex: number;

  /** True when this chunk signals the end of reasoning output. */
  readonly isComplete: boolean;

  /** Provider-specific metadata (e.g., signature for Anthropic, effort for OpenAI). */
  readonly metadata: AdapterMeta;
}

// ---------------------------------------------------------------------------
// ReasoningStreamAdapter -- per-provider adapter contract
// ---------------------------------------------------------------------------

/**
 * Per-provider adapter that normalizes SDK streaming events to ReasoningChunk.
 * Selected at runtime by the adapter registry based on model/provider metadata.
 */
export interface ReasoningStreamAdapter {
  /** Unique adapter identifier (e.g., "openai", "anthropic", "deepseek", "tag-fallback"). */
  readonly id: string;

  /**
   * Return true if this adapter handles the given model/provider combination.
   * Called once at stream start to select the active adapter.
   */
  canHandle(params: { model: string; provider: string }): boolean;

  /**
   * Attempt to parse a ReasoningChunk from an SDK streaming event.
   * Returns null if the event is not a reasoning event (e.g., text_delta).
   */
  parseChunk(event: AssistantMessageEvent): ReasoningChunk | null;

  /** Reset internal state between messages. Called at message_start. */
  reset(): void;
}

// ---------------------------------------------------------------------------
// createReasoningChunk -- factory with sensible defaults
// ---------------------------------------------------------------------------

/** Input fields for creating a ReasoningChunk. All fields except `provider` and `phase` have defaults. */
export interface ReasoningChunkInit {
  provider: ReasoningChunk["provider"];
  phase: ReasoningPhase;
  text?: string;
  contentIndex?: number;
  isComplete?: boolean;
  metadata?: AdapterMeta;
}

/** Create a ReasoningChunk with sensible defaults for optional fields. */
export function createReasoningChunk(init: ReasoningChunkInit): ReasoningChunk {
  return {
    provider: init.provider,
    phase: init.phase,
    text: init.text ?? "",
    contentIndex: init.contentIndex ?? 0,
    isComplete: init.isComplete ?? init.phase === "end",
    metadata: init.metadata ?? {},
  };
}
