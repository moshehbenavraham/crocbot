import { hashText } from "../memory/internal.js";
import type { ChunkingOptions, DocumentChunk, ParsedDocument } from "./types.js";

// -- Constants --

/** Approximate characters per token (matching chunkMarkdown in memory/internal.ts). */
const CHARS_PER_TOKEN = 4;

/** Minimum character budget per chunk to avoid degenerate splits. */
const MIN_CHUNK_CHARS = 32;

/** Default chunking configuration. */
export const DEFAULT_CHUNKING: ChunkingOptions = {
  tokens: 400,
  overlap: 80,
  headingAware: true,
};

// -- Heading detection --

/** Matches markdown heading lines: `# Heading`, `## Heading`, etc. */
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

/** Extract heading level (1-6) and text from a line, or null if not a heading. */
function parseHeading(line: string): { level: number; text: string } | null {
  const match = HEADING_RE.exec(line);
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return { level: match[1].length, text: match[2].trim() };
}

// -- Internal types --

interface LineEntry {
  readonly line: string;
  readonly lineNo: number;
}

interface Section {
  readonly heading: string | undefined;
  readonly lines: LineEntry[];
}

// -- Section splitting --

/**
 * Split content into sections by top-level headings.
 * Each section carries its nearest heading context.
 */
function splitSections(lines: string[], headingAware: boolean): Section[] {
  if (!headingAware) {
    return [
      {
        heading: undefined,
        lines: lines.map((line, i) => ({ line, lineNo: i + 1 })),
      },
    ];
  }

  const sections: Section[] = [];
  let currentHeading: string | undefined;
  let currentLines: LineEntry[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? "";
    const lineNo = i + 1;
    const heading = parseHeading(rawLine);

    if (heading) {
      // Flush previous section if it has content
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, lines: currentLines });
        currentLines = [];
      }
      currentHeading = heading.text;
      currentLines.push({ line: rawLine, lineNo });
    } else {
      currentLines.push({ line: rawLine, lineNo });
    }
  }

  // Flush remaining
  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, lines: currentLines });
  }

  return sections;
}

// -- Core chunking --

/**
 * Chunk a section's lines into text segments respecting token limits and overlap.
 * Returns raw chunk data (text, startLine, endLine) without IDs.
 */
function chunkLines(
  entries: LineEntry[],
  maxChars: number,
  overlapChars: number,
): Array<{ text: string; startLine: number; endLine: number }> {
  const results: Array<{ text: string; startLine: number; endLine: number }> = [];

  let current: LineEntry[] = [];
  let currentChars = 0;

  const flush = (): void => {
    if (current.length === 0) {
      return;
    }
    const first = current[0];
    const last = current[current.length - 1];
    if (!first || !last) {
      return;
    }
    const text = current.map((e) => e.line).join("\n");
    results.push({ text, startLine: first.lineNo, endLine: last.lineNo });
  };

  const carryOverlap = (): void => {
    if (overlapChars <= 0 || current.length === 0) {
      current = [];
      currentChars = 0;
      return;
    }
    let acc = 0;
    const kept: LineEntry[] = [];
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const entry = current[i];
      if (!entry) {
        continue;
      }
      acc += entry.line.length + 1;
      kept.unshift(entry);
      if (acc >= overlapChars) {
        break;
      }
    }
    current = kept;
    currentChars = kept.reduce((sum, e) => sum + e.line.length + 1, 0);
  };

  for (const entry of entries) {
    // Split very long lines into segments
    const segments: string[] = [];
    if (entry.line.length === 0) {
      segments.push("");
    } else {
      for (let start = 0; start < entry.line.length; start += maxChars) {
        segments.push(entry.line.slice(start, start + maxChars));
      }
    }

    for (const segment of segments) {
      const segSize = segment.length + 1;
      if (currentChars + segSize > maxChars && current.length > 0) {
        flush();
        carryOverlap();
      }
      current.push({ line: segment, lineNo: entry.lineNo });
      currentChars += segSize;
    }
  }

  flush();
  return results;
}

// -- Public API --

/**
 * Chunk a parsed document into `DocumentChunk[]` with semantic boundary awareness.
 *
 * When `headingAware` is true (default for markdown), content is first split by
 * headings into sections. Each section is independently chunked, and the nearest
 * parent heading propagates to all chunks in that section via `headingContext`.
 *
 * Token limits are approximated at ~4 chars/token matching existing infrastructure.
 */
export function chunkDocument(
  doc: ParsedDocument,
  options?: Partial<ChunkingOptions>,
): DocumentChunk[] {
  const opts: ChunkingOptions = {
    tokens: options?.tokens ?? DEFAULT_CHUNKING.tokens,
    overlap: options?.overlap ?? DEFAULT_CHUNKING.overlap,
    headingAware: options?.headingAware ?? DEFAULT_CHUNKING.headingAware,
  };

  const content = doc.content;
  if (!content || content.trim().length === 0) {
    return [];
  }

  const lines = content.split("\n");
  const maxChars = Math.max(MIN_CHUNK_CHARS, opts.tokens * CHARS_PER_TOKEN);
  const overlapChars = Math.max(0, opts.overlap * CHARS_PER_TOKEN);
  const sections = splitSections(lines, opts.headingAware ?? true);

  // Collect raw chunks from all sections with heading context
  const rawChunks: Array<{
    text: string;
    startLine: number;
    endLine: number;
    headingContext: string | undefined;
  }> = [];

  for (const section of sections) {
    const sectionChunks = chunkLines(section.lines, maxChars, overlapChars);
    for (const chunk of sectionChunks) {
      rawChunks.push({
        ...chunk,
        headingContext: section.heading,
      });
    }
  }

  const total = rawChunks.length;
  const sourceValue = doc.source.value;

  return rawChunks.map((raw, index) => {
    const hash = hashText(raw.text);
    const id = hashText(`${sourceValue}\0${index}\0${raw.text}`);
    return {
      id,
      text: raw.text,
      hash,
      index,
      total,
      startLine: raw.startLine,
      endLine: raw.endLine,
      sourceValue,
      headingContext: raw.headingContext,
    };
  });
}
