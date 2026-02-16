/**
 * Prompt builders and response parser for the consolidation LLM calls.
 *
 * The consolidation engine sends a system prompt describing the five actions
 * and a message prompt with the new memory + similar existing memories to the
 * utility model. The response is expected to be JSON with an action decision.
 *
 * @see docs/adr/0007-memory-consolidation-architecture.md
 */

import {
  ConsolidationAction,
  type MemoryArea,
  type SimilarChunk,
} from "./consolidation-actions.js";

// ---------------------------------------------------------------------------
// Parsed LLM response
// ---------------------------------------------------------------------------

/** Parsed and validated consolidation response from the LLM. */
export interface ParsedConsolidationResponse {
  action: ConsolidationAction;
  reasoning: string;
  targetId?: string;
  newMemoryContent?: string;
  updatedContent?: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const CONSOLIDATION_SYSTEM_PROMPT = `You are a memory consolidation specialist for a personal AI assistant.

Your task: Given a NEW memory and a list of SIMILAR existing memories, decide
the best consolidation action. You must preserve factual accuracy and temporal
context at all times.

## Guidelines

1. SIMILARITY AWARENESS: High similarity (>0.9) suggests near-duplicates.
   Moderate similarity (0.7-0.9) suggests related but distinct content.
2. TEMPORAL INTELLIGENCE: Newer information generally supersedes older
   information on the same topic, but historical context can be valuable.
3. CONTENT RELATIONSHIPS: Look for complementary information that can be
   merged, contradictions that need resolution, and redundancies to eliminate.
4. QUALITY ASSESSMENT: Prefer more detailed, accurate, and well-structured
   memories over vague or incomplete ones.
5. KNOWLEDGE SOURCE AWARENESS: Memories from different sources (user input,
   extracted facts, problem/solution pairs) may overlap but serve different
   retrieval patterns.

## Actions

- MERGE: Combine the new memory with one or more existing memories into a
  single comprehensive entry. Use when memories cover the same topic and
  merging produces a better single reference. Provide the merged text in
  "new_memory_content".
- REPLACE: The new memory fully supersedes an existing memory. The existing
  memory will be removed. Use for corrections, updates, or strict duplicates.
  Specify "target_id" of the memory to replace.
- KEEP_SEPARATE: Store the new memory alongside existing ones. Use when
  memories are related but cover distinct aspects worth separate retrieval.
- UPDATE: Modify an existing memory in place and optionally add the new
  memory alongside it. Provide "target_id" and "updated_content" for the
  existing memory, and optionally "new_memory_content" for an additional
  entry.
- SKIP: Do not store the new memory. Use only when the new memory adds zero
  information beyond what already exists.

## Response Format

Respond with valid JSON only. No markdown fencing. No commentary outside JSON.

{
  "action": "MERGE" | "REPLACE" | "KEEP_SEPARATE" | "UPDATE" | "SKIP",
  "reasoning": "Brief explanation of the decision",
  "target_id": "id of existing memory (for REPLACE/UPDATE, omit otherwise)",
  "new_memory_content": "merged or new text (for MERGE/UPDATE, omit for others)",
  "updated_content": "modified existing text (for UPDATE only, omit otherwise)"
}

## Quality Principles

- Never discard factual information without a clear reason
- Prefer KEEP_SEPARATE over lossy MERGE when in doubt
- Preserve timestamps and source attribution
- Keep merged memories concise but complete`;

/** Build the consolidation system prompt. */
export function buildConsolidationSystemPrompt(): string {
  return CONSOLIDATION_SYSTEM_PROMPT;
}

// ---------------------------------------------------------------------------
// Message prompt
// ---------------------------------------------------------------------------

/** Build the consolidation message prompt with area, new memory, and similar memories. */
export function buildConsolidationMessagePrompt(params: {
  area: MemoryArea;
  newMemory: string;
  similarMemories: SimilarChunk[];
}): string {
  const timestamp = new Date().toISOString();
  const parts: string[] = [
    `Memory area: ${params.area}`,
    `Timestamp: ${timestamp}`,
    "",
    "## New Memory",
    "",
    params.newMemory,
    "",
    "## Similar Existing Memories",
    "",
  ];

  if (params.similarMemories.length === 0) {
    parts.push("(none)");
  } else {
    for (const mem of params.similarMemories) {
      parts.push(`### Memory [${mem.id}] (similarity: ${mem.score.toFixed(3)}, area: ${mem.area})`);
      parts.push("");
      parts.push(mem.text);
      parts.push("");
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

const VALID_ACTIONS = new Set<string>(Object.values(ConsolidationAction));

/**
 * Parse the LLM response into a structured consolidation decision.
 *
 * Handles common LLM response issues:
 * - JSON wrapped in markdown fencing (```json ... ```)
 * - Trailing text after JSON
 * - Missing or invalid fields
 *
 * Falls back to KEEP_SEPARATE on any parse failure.
 */
export function parseConsolidationResponse(raw: string): ParsedConsolidationResponse {
  const fallback: ParsedConsolidationResponse = {
    action: ConsolidationAction.KEEP_SEPARATE,
    reasoning: "fallback: could not parse LLM response",
  };

  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  let jsonStr = raw.trim();

  // Strip markdown fencing if present
  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(jsonStr);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Try to extract the first JSON object if there's trailing text
  const braceStart = jsonStr.indexOf("{");
  const braceEnd = jsonStr.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return fallback;
  }

  // Validate action field
  const action = typeof parsed.action === "string" ? parsed.action.toUpperCase() : undefined;
  if (!action || !VALID_ACTIONS.has(action)) {
    return {
      ...fallback,
      reasoning: `fallback: unknown action "${String(parsed.action)}"`,
    };
  }

  // Validate reasoning field
  const reasoning =
    typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
      ? parsed.reasoning
      : "no reasoning provided";

  const result: ParsedConsolidationResponse = {
    action: action as ConsolidationAction,
    reasoning,
  };

  if (typeof parsed.target_id === "string" && parsed.target_id.length > 0) {
    result.targetId = parsed.target_id;
  }

  if (typeof parsed.new_memory_content === "string" && parsed.new_memory_content.length > 0) {
    result.newMemoryContent = parsed.new_memory_content;
  }

  if (typeof parsed.updated_content === "string" && parsed.updated_content.length > 0) {
    result.updatedContent = parsed.updated_content;
  }

  return result;
}
