import type { AssistantMessageEvent } from "@mariozechner/pi-ai";

import { createReasoningChunk } from "../types.js";
import type { ReasoningChunk, ReasoningStreamAdapter } from "../types.js";

const PROVIDER_ID = "tag-fallback" as const;

/**
 * Regex matching open and close thinking tags.
 * Reuses the same pattern as `src/shared/text/reasoning-tags.ts` THINKING_TAG_RE.
 * Capture group 1 is "/" for close tags, empty for open tags.
 */
const THINKING_TAG_RE = /<\s*(\/?)\s*(?:think(?:ing)?|thought|antthinking)\b[^>]*>/gi;

/**
 * Partial tag detection: detects a potential tag starting with "<" at the end of
 * a chunk that could be completed in the next chunk.
 *
 * Matches a trailing "<" followed by optional whitespace, optional "/", and
 * partial characters that could form a thinking tag name.
 */
const PARTIAL_TAG_TAIL_RE = /<\s*\/?\s*[tahinkouglt]{0,12}$/i;

/**
 * Tag-fallback adapter.
 *
 * Processes `text_delta` events containing `<think>` tags using stateful
 * cross-chunk boundary handling. This is the lowest-priority adapter,
 * used when no native reasoning adapter matches.
 *
 * Design follows the `blockState` pattern from `pi-embedded-subscribe.ts`:
 * a boolean `thinking` flag tracks whether we are inside a thinking block
 * across chunk boundaries. A `buffer` holds trailing partial tags that
 * might span chunks.
 */
export class TagFallbackAdapter implements ReasoningStreamAdapter {
  readonly id = PROVIDER_ID;

  /** True when inside a `<think>` block (persists across chunks). */
  private thinking = false;

  /** Whether we have emitted a "start" chunk for the current block. */
  private started = false;

  /** Buffer for potential partial tag at end of chunk. */
  private buffer = "";

  /** Content index from the last processed event. */
  private lastContentIndex = 0;

  canHandle(_params: { model: string; provider: string }): boolean {
    return true;
  }

  parseChunk(event: AssistantMessageEvent): ReasoningChunk | null {
    if (event.type !== "text_delta") {
      return null;
    }

    const delta = event.delta;
    this.lastContentIndex = event.contentIndex;

    // Prepend any buffered partial tag from the previous chunk
    const text = this.buffer + delta;
    this.buffer = "";

    // Check for a partial tag at the end of the combined text
    const partialMatch = PARTIAL_TAG_TAIL_RE.exec(text);
    let processable: string;
    if (partialMatch && partialMatch.index > 0 && text.length - partialMatch.index < 30) {
      // Buffer the potential partial tag for next chunk
      this.buffer = text.slice(partialMatch.index);
      processable = text.slice(0, partialMatch.index);
    } else if (partialMatch && partialMatch.index === 0 && text.length < 30) {
      // Entire text is a potential partial tag -- buffer it
      this.buffer = text;
      return null;
    } else {
      processable = text;
    }

    return this.processText(processable);
  }

  reset(): void {
    this.thinking = false;
    this.started = false;
    this.buffer = "";
    this.lastContentIndex = 0;
  }

  /**
   * Process text that has been cleared of partial-tag ambiguity.
   * Extracts reasoning content between `<think>` and `</think>` tags,
   * maintaining stateful tracking across chunks.
   */
  private processText(text: string): ReasoningChunk | null {
    if (!text) {
      return null;
    }

    // Reset the regex for each call
    THINKING_TAG_RE.lastIndex = 0;

    let reasoningText = "";
    let lastIndex = 0;
    let wasThinking = this.thinking;

    for (const match of text.matchAll(THINKING_TAG_RE)) {
      const idx = match.index ?? 0;
      const isClose = match[1] === "/";

      if (this.thinking && isClose) {
        // Collect text before the close tag (this is reasoning content)
        reasoningText += text.slice(lastIndex, idx);
        this.thinking = false;
        lastIndex = idx + match[0].length;
      } else if (!this.thinking && !isClose) {
        // Open tag: start collecting reasoning
        this.thinking = true;
        lastIndex = idx + match[0].length;
      } else {
        // Tag inside thinking block (e.g., nested tag) or orphan close -- skip tag itself
        lastIndex = idx + match[0].length;
      }
    }

    // If still inside thinking block, remaining text after last tag is reasoning
    if (this.thinking) {
      reasoningText += text.slice(lastIndex);
    }

    // Determine what to emit based on state transitions
    if (!wasThinking && !this.thinking && reasoningText) {
      // Block opened and closed in same chunk -- emit end with captured text
      this.started = false;
      return createReasoningChunk({
        provider: PROVIDER_ID,
        phase: "end",
        text: reasoningText,
        contentIndex: this.lastContentIndex,
      });
    }

    if (!wasThinking && this.thinking && !reasoningText) {
      // Just opened a thinking block -- emit start
      this.started = true;
      return createReasoningChunk({
        provider: PROVIDER_ID,
        phase: "start",
        contentIndex: this.lastContentIndex,
      });
    }

    if (!wasThinking && this.thinking && reasoningText) {
      // Opened thinking block and already have content in same chunk
      this.started = true;
      return createReasoningChunk({
        provider: PROVIDER_ID,
        phase: "delta",
        text: reasoningText,
        contentIndex: this.lastContentIndex,
      });
    }

    if (wasThinking && this.thinking && reasoningText) {
      // Continuing inside thinking block with content
      return createReasoningChunk({
        provider: PROVIDER_ID,
        phase: "delta",
        text: reasoningText,
        contentIndex: this.lastContentIndex,
      });
    }

    if (wasThinking && !this.thinking) {
      // Closed thinking block
      if (reasoningText) {
        return createReasoningChunk({
          provider: PROVIDER_ID,
          phase: "end",
          text: reasoningText,
          contentIndex: this.lastContentIndex,
        });
      }
      this.started = false;
      return createReasoningChunk({
        provider: PROVIDER_ID,
        phase: "end",
        contentIndex: this.lastContentIndex,
      });
    }

    // Not in thinking and no tag transitions -- nothing to emit
    return null;
  }
}
