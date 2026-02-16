/**
 * Per-session reasoning token budget tracker.
 *
 * Tracks cumulative reasoning token consumption and emits warning/exceeded
 * events via `emitAgentEvent()` when configurable thresholds are crossed.
 * State is in-memory per session -- it does not persist across restarts.
 */

import { emitAgentEvent, onAgentEvent } from "../../infra/agent-events.js";
import type { AgentEventPayload } from "../../infra/agent-events.js";
import type { ReasoningBudgetConfig } from "../../config/types.agent-defaults.js";

export interface BudgetTrackerOptions {
  /** Max reasoning tokens per session (0 = unlimited). */
  maxReasoningTokensPerSession: number;
  /** Percentage of max at which to emit a warning (1-100, default 80). */
  warningThresholdPercent: number;
  /** Run ID for event emission. */
  runId: string;
  /** Optional session key for event emission. */
  sessionKey?: string;
}

export type BudgetStatus = "ok" | "warning" | "exceeded";

/**
 * Tracks per-session reasoning token consumption with configurable
 * threshold warnings emitted as agent events.
 */
export class ReasoningBudgetTracker {
  private totalTokens = 0;
  private warningEmitted = false;
  private exceededEmitted = false;
  private readonly maxTokens: number;
  private readonly warningThreshold: number;
  private runId: string;
  private sessionKey?: string;

  constructor(options: BudgetTrackerOptions) {
    this.maxTokens = options.maxReasoningTokensPerSession;
    this.warningThreshold = Math.max(1, Math.min(100, options.warningThresholdPercent));
    this.runId = options.runId;
    this.sessionKey = options.sessionKey;
  }

  /** Current cumulative reasoning token count. */
  get tokens(): number {
    return this.totalTokens;
  }

  /** Whether this tracker is in unlimited mode (maxTokens = 0). */
  get isUnlimited(): boolean {
    return this.maxTokens === 0;
  }

  /** Current budget status. */
  get status(): BudgetStatus {
    if (this.isUnlimited) {
      return "ok";
    }
    if (this.totalTokens >= this.maxTokens) {
      return "exceeded";
    }
    if (this.totalTokens >= this.maxTokens * (this.warningThreshold / 100)) {
      return "warning";
    }
    return "ok";
  }

  /** Update the run ID (e.g., when a new run starts within the same session). */
  setRunId(runId: string, sessionKey?: string): void {
    this.runId = runId;
    if (sessionKey !== undefined) {
      this.sessionKey = sessionKey;
    }
  }

  /**
   * Add reasoning tokens to the cumulative count.
   * Emits warning/exceeded events when thresholds are crossed.
   * Ignores non-positive values.
   */
  addTokens(count: number): void {
    if (count <= 0) {
      return;
    }
    this.totalTokens += count;

    if (this.isUnlimited) {
      return;
    }

    const warningLevel = this.maxTokens * (this.warningThreshold / 100);

    if (!this.exceededEmitted && this.totalTokens >= this.maxTokens) {
      this.exceededEmitted = true;
      this.warningEmitted = true;
      emitAgentEvent({
        runId: this.runId,
        stream: "budget",
        sessionKey: this.sessionKey,
        data: {
          type: "exceeded",
          reasoningTokens: this.totalTokens,
          maxReasoningTokens: this.maxTokens,
          percent: Math.round((this.totalTokens / this.maxTokens) * 100),
        },
      });
      return;
    }

    if (!this.warningEmitted && this.totalTokens >= warningLevel) {
      this.warningEmitted = true;
      emitAgentEvent({
        runId: this.runId,
        stream: "budget",
        sessionKey: this.sessionKey,
        data: {
          type: "warning",
          reasoningTokens: this.totalTokens,
          maxReasoningTokens: this.maxTokens,
          percent: Math.round((this.totalTokens / this.maxTokens) * 100),
        },
      });
    }
  }

  /** Reset the tracker to initial state (0 tokens, no warnings). */
  reset(): void {
    this.totalTokens = 0;
    this.warningEmitted = false;
    this.exceededEmitted = false;
  }

  /** Create a BudgetTrackerOptions from config with defaults. */
  static fromConfig(
    config: ReasoningBudgetConfig | undefined,
    runId: string,
    sessionKey?: string,
  ): BudgetTrackerOptions {
    return {
      maxReasoningTokensPerSession: config?.maxReasoningTokensPerSession ?? 0,
      warningThresholdPercent: config?.warningThresholdPercent ?? 80,
      runId,
      sessionKey,
    };
  }
}

/**
 * Subscribe the budget tracker to `"thinking"` stream events via the agent
 * event bus. Extracts `reasoningTokens` from the event payload and feeds
 * them to the tracker. Returns an unsubscribe function.
 */
export function initBudgetTrackerListener(tracker: ReasoningBudgetTracker): () => void {
  return onAgentEvent((evt: AgentEventPayload) => {
    if (evt.stream !== "thinking") {
      return;
    }
    const tokens = evt.data.reasoningTokens;
    if (typeof tokens === "number" && tokens > 0) {
      tracker.setRunId(evt.runId, evt.sessionKey);
      tracker.addTokens(tokens);
    }
  });
}
