import type { ReasoningChunk } from "./types.js";

// ---------------------------------------------------------------------------
// ThinkingPair -- a [reasoning, response] tuple for session persistence
// ---------------------------------------------------------------------------

/** A structured pair of reasoning text and its associated response text. */
export type ThinkingPair = readonly [reasoning: string, response: string];

// ---------------------------------------------------------------------------
// ChatGenerationResultOptions -- constructor configuration
// ---------------------------------------------------------------------------

/** Options for constructing a ChatGenerationResult accumulator. */
export interface ChatGenerationResultOptions {
  /** Optional adapter ID for logging/debugging. */
  readonly adapterId?: string;
}

// ---------------------------------------------------------------------------
// ChatGenerationResult -- accumulator for reasoning/response separation
// ---------------------------------------------------------------------------

/**
 * Accumulates ReasoningChunk events and separates reasoning content from
 * response content. Provides cursor-based delta extraction for incremental
 * streaming emission.
 *
 * Lifecycle: create at message_start, feed chunks during streaming,
 * finalize at message_end/done. After finalization, the accumulator is
 * sealed -- no further chunks are accepted.
 *
 * Buffers grow monotonically; cursors only advance. No rewind or mutation.
 */
export class ChatGenerationResult {
  /** Accumulated reasoning text. */
  private reasoningBuffer = "";

  /** Accumulated response text. */
  private responseBuffer = "";

  /** Cursor: position of last emitted reasoning delta. */
  private reasoningCursor = 0;

  /** Cursor: position of last emitted response delta. */
  private responseCursor = 0;

  /** Whether currently inside a reasoning block. */
  private isReasoningActive = false;

  /** Structured [reasoning, response] tuples for persistence. */
  private readonly pairs: Array<{ reasoning: string; response: string }> = [];

  /** Whether the accumulator has been finalized. */
  private finalized = false;

  /** Optional adapter ID for debugging. */
  readonly adapterId: string;

  constructor(options?: ChatGenerationResultOptions) {
    this.adapterId = options?.adapterId ?? "";
  }

  // -- Chunk ingestion ----------------------------------------------------

  /**
   * Feed a ReasoningChunk into the accumulator.
   * Routes by phase: start/delta/end go to reasoning buffer;
   * the response buffer is fed separately via addResponseText().
   *
   * @throws Error if called after finalize().
   */
  addChunk(chunk: ReasoningChunk): void {
    if (this.finalized) {
      throw new Error("ChatGenerationResult is finalized; cannot add more chunks");
    }

    switch (chunk.phase) {
      case "start":
        this.handleStart();
        // Some adapters emit text with the start event
        if (chunk.text) {
          this.reasoningBuffer += chunk.text;
        }
        break;
      case "delta":
        if (!this.isReasoningActive) {
          // Implicit start if we get a delta without a start event
          this.handleStart();
        }
        this.reasoningBuffer += chunk.text;
        break;
      case "end":
        // Capture any trailing text in the end event
        if (chunk.text) {
          this.reasoningBuffer += chunk.text;
        }
        this.handleEnd();
        break;
    }
  }

  /**
   * Append raw text directly to the response buffer.
   * Used for text_delta events that bypass the adapter pipeline.
   *
   * @throws Error if called after finalize().
   */
  addResponseText(text: string): void {
    if (this.finalized) {
      throw new Error("ChatGenerationResult is finalized; cannot add more text");
    }
    if (text) {
      this.responseBuffer += text;
    }
  }

  // -- Delta extraction ---------------------------------------------------

  /**
   * Return reasoning text added since the last call to this method.
   * Cursor advances monotonically -- calling twice without new content
   * returns an empty string.
   */
  getReasoningDelta(): string {
    const delta = this.reasoningBuffer.slice(this.reasoningCursor);
    this.reasoningCursor = this.reasoningBuffer.length;
    return delta;
  }

  /**
   * Return response text added since the last call to this method.
   * Cursor advances monotonically.
   */
  getResponseDelta(): string {
    const delta = this.responseBuffer.slice(this.responseCursor);
    this.responseCursor = this.responseBuffer.length;
    return delta;
  }

  // -- Read-only getters --------------------------------------------------

  /** Full accumulated reasoning text. */
  get reasoningText(): string {
    return this.reasoningBuffer;
  }

  /** Full accumulated response text. */
  get responseText(): string {
    return this.responseBuffer;
  }

  /** Whether reasoning is currently being streamed (inside a thinking block). */
  get isReasoning(): boolean {
    return this.isReasoningActive;
  }

  /** Whether the accumulator has been finalized. */
  get isFinalized(): boolean {
    return this.finalized;
  }

  // -- Finalization -------------------------------------------------------

  /**
   * Seal the accumulator. Closes any open thinking pair and prevents
   * further chunk ingestion. Returns the final thinking pairs.
   *
   * Safe to call multiple times -- subsequent calls return the same result.
   */
  finalize(): readonly ThinkingPair[] {
    if (!this.finalized) {
      this.finalized = true;

      // Close any open reasoning block
      if (this.isReasoningActive) {
        this.isReasoningActive = false;
      }

      // Close the final pair if there is reasoning or response content
      this.closePair();
    }

    return this.thinkingPairs;
  }

  /**
   * Structured [reasoning, response] tuples built during accumulation.
   * Only complete after finalize() is called.
   */
  get thinkingPairs(): readonly ThinkingPair[] {
    return this.pairs.map((p) => [p.reasoning, p.response] as const);
  }

  // -- Internal helpers ---------------------------------------------------

  /** Start a new reasoning block. */
  private handleStart(): void {
    // If there was a previous response, close the pair before starting new reasoning
    if (!this.isReasoningActive && (this.hasOpenReasoning() || this.hasOpenResponse())) {
      this.closePair();
    }
    this.isReasoningActive = true;
  }

  /** End the current reasoning block. */
  private handleEnd(): void {
    this.isReasoningActive = false;
  }

  /** Close the current reasoning/response pair and push it. */
  private closePair(): void {
    const lastPair = this.pairs[this.pairs.length - 1];
    const currentReasoning = this.getCurrentPairReasoning();
    const currentResponse = this.getCurrentPairResponse();

    // Only push a new pair if there's actually content
    if (currentReasoning || currentResponse) {
      // Avoid duplicating content already captured in the last pair
      if (
        !lastPair ||
        currentReasoning !== lastPair.reasoning ||
        currentResponse !== lastPair.response
      ) {
        this.pairs.push({
          reasoning: currentReasoning,
          response: currentResponse,
        });
      }
    }
  }

  /** Get reasoning text for the current (not-yet-closed) pair. */
  private getCurrentPairReasoning(): string {
    // Reasoning text that hasn't been captured in a pair yet
    const captured = this.pairs.reduce((sum, p) => sum + p.reasoning.length, 0);
    return this.reasoningBuffer.slice(captured);
  }

  /** Get response text for the current (not-yet-closed) pair. */
  private getCurrentPairResponse(): string {
    const captured = this.pairs.reduce((sum, p) => sum + p.response.length, 0);
    return this.responseBuffer.slice(captured);
  }

  /** Whether there is uncaptured reasoning content. */
  private hasOpenReasoning(): boolean {
    const captured = this.pairs.reduce((sum, p) => sum + p.reasoning.length, 0);
    return this.reasoningBuffer.length > captured;
  }

  /** Whether there is uncaptured response content. */
  private hasOpenResponse(): boolean {
    const captured = this.pairs.reduce((sum, p) => sum + p.response.length, 0);
    return this.responseBuffer.length > captured;
  }
}
