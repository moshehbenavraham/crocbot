/**
 * Prompt templates for auto-memorize extraction.
 *
 * Three extraction types (solutions, fragments, instruments), each with a
 * system prompt and a user-prompt builder that accepts the conversation
 * transcript text.
 */

import type { MemoryArea } from "./consolidation-actions.js";

// ---------------------------------------------------------------------------
// Shared JSON schema description
// ---------------------------------------------------------------------------

const IMPORTANCE_FIELD_DOC =
  "importance: number 0.0-1.0 indicating how valuable this item is for future reference. " +
  "0.0 = trivial, 0.5 = moderately useful, 1.0 = critical/must-remember.";

// ---------------------------------------------------------------------------
// Solution extraction
// ---------------------------------------------------------------------------

export const SOLUTION_SYSTEM_PROMPT =
  "You are a knowledge extractor. Your task is to identify problem/solution pairs " +
  "from a conversation transcript. For each pair, extract the problem description, " +
  "the solution steps, and any relevant context.\n\n" +
  "Rules:\n" +
  "- Only extract clear problem/solution patterns where a problem was stated and resolved.\n" +
  "- Do NOT invent or hallucinate solutions that were not present in the conversation.\n" +
  "- If no problem/solution pairs exist, return an empty array.\n" +
  "- Return valid JSON only, no markdown fences.\n\n" +
  "Output JSON schema:\n" +
  "[\n" +
  '  {\n    "problem": "string describing the problem",\n' +
  '    "solution": "string describing the solution steps",\n' +
  '    "context": "optional string with extra context",\n' +
  `    "${IMPORTANCE_FIELD_DOC}"\n` +
  "  }\n" +
  "]\n\n" +
  "Example output:\n" +
  '[\n  {\n    "problem": "Docker container fails to start with OOM error",\n' +
  '    "solution": "Increase memory limit in docker-compose.yml to 2G",\n' +
  '    "context": "Node.js application with memory-intensive image processing",\n' +
  '    "importance": 0.8\n  }\n]';

export function buildSolutionUserPrompt(transcript: string): string {
  return (
    "Extract all problem/solution pairs from this conversation. " +
    "Return a JSON array (empty array if none found).\n\n" +
    "Conversation transcript:\n" +
    transcript
  );
}

export const SOLUTION_AREA: MemoryArea = "solutions";

// ---------------------------------------------------------------------------
// Fragment extraction
// ---------------------------------------------------------------------------

export const FRAGMENT_SYSTEM_PROMPT =
  "You are a knowledge extractor. Your task is to identify key facts, user preferences, " +
  "and notable information from a conversation transcript.\n\n" +
  "Rules:\n" +
  "- Extract facts, preferences, decisions, and notable information stated in the conversation.\n" +
  "- Focus on information that would be useful to remember for future conversations.\n" +
  "- Do NOT extract trivial greetings or conversational filler.\n" +
  "- Do NOT extract information that is only relevant within the current conversation context.\n" +
  "- If no notable facts or preferences exist, return an empty array.\n" +
  "- Return valid JSON only, no markdown fences.\n\n" +
  "Output JSON schema:\n" +
  "[\n" +
  '  {\n    "fact": "string describing the key fact or preference",\n' +
  '    "category": "preference | fact | decision",\n' +
  `    "${IMPORTANCE_FIELD_DOC}"\n` +
  "  }\n" +
  "]\n\n" +
  "Example output:\n" +
  '[\n  {\n    "fact": "User prefers TypeScript with strict mode enabled",\n' +
  '    "category": "preference",\n' +
  '    "importance": 0.7\n  }\n]';

export function buildFragmentUserPrompt(transcript: string): string {
  return (
    "Extract key facts, preferences, and notable information from this conversation. " +
    "Return a JSON array (empty array if none found).\n\n" +
    "Conversation transcript:\n" +
    transcript
  );
}

export const FRAGMENT_AREA: MemoryArea = "fragments";

// ---------------------------------------------------------------------------
// Instrument extraction
// ---------------------------------------------------------------------------

export const INSTRUMENT_SYSTEM_PROMPT =
  "You are a knowledge extractor. Your task is to identify tools, techniques, " +
  "and methods that were discussed or used in a conversation transcript.\n\n" +
  "Rules:\n" +
  "- Extract tools (software, libraries, APIs), techniques (patterns, approaches), " +
  "and methods (workflows, processes) mentioned or used.\n" +
  "- Include relevant usage context or configuration details.\n" +
  "- Do NOT extract generic/obvious tools (e.g., 'a web browser') unless specific " +
  "configuration or usage details are provided.\n" +
  "- If no notable tools, techniques, or methods exist, return an empty array.\n" +
  "- Return valid JSON only, no markdown fences.\n\n" +
  "Output JSON schema:\n" +
  "[\n" +
  '  {\n    "name": "string name of the tool, technique, or method",\n' +
  '    "description": "string describing what it does and how it was used",\n' +
  '    "type": "tool | technique | method",\n' +
  `    "${IMPORTANCE_FIELD_DOC}"\n` +
  "  }\n" +
  "]\n\n" +
  "Example output:\n" +
  '[\n  {\n    "name": "sqlite-vec",\n' +
  '    "description": "SQLite extension for vector similarity search, used for memory deduplication",\n' +
  '    "type": "tool",\n' +
  '    "importance": 0.6\n  }\n]';

export function buildInstrumentUserPrompt(transcript: string): string {
  return (
    "Extract tools, techniques, and methods from this conversation. " +
    "Return a JSON array (empty array if none found).\n\n" +
    "Conversation transcript:\n" +
    transcript
  );
}

export const INSTRUMENT_AREA: MemoryArea = "instruments";

// ---------------------------------------------------------------------------
// Extraction type registry
// ---------------------------------------------------------------------------

export type ExtractionType = "solutions" | "fragments" | "instruments";

export interface ExtractionPromptSet {
  systemPrompt: string;
  buildUserPrompt: (transcript: string) => string;
  area: MemoryArea;
}

export const EXTRACTION_PROMPTS: Record<ExtractionType, ExtractionPromptSet> = {
  solutions: {
    systemPrompt: SOLUTION_SYSTEM_PROMPT,
    buildUserPrompt: buildSolutionUserPrompt,
    area: SOLUTION_AREA,
  },
  fragments: {
    systemPrompt: FRAGMENT_SYSTEM_PROMPT,
    buildUserPrompt: buildFragmentUserPrompt,
    area: FRAGMENT_AREA,
  },
  instruments: {
    systemPrompt: INSTRUMENT_SYSTEM_PROMPT,
    buildUserPrompt: buildInstrumentUserPrompt,
    area: INSTRUMENT_AREA,
  },
};
