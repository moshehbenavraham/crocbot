/**
 * Multi-pattern masking engine for secret values.
 *
 * Replaces registered secret values (and their encoded variants) with
 * deterministic {{SECRET:hash8}} placeholders.  Uses longest-match-first
 * sequential replacement for small pattern sets and a custom Aho-Corasick
 * trie for larger ones (>=10 patterns).
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Encoding variant of a registered secret. */
type EncodingVariant = "raw" | "base64" | "url";

/** A single pattern entry in the masker's lookup table. */
interface MaskerPattern {
  /** The literal string to search for in text. */
  needle: string;
  /** Deterministic placeholder that replaces the needle. */
  placeholder: string;
  /** Original raw secret value this pattern derives from. */
  rawValue: string;
  /** Which encoding produced this needle. */
  encoding: EncodingVariant;
}

/** Compiled pattern table returned by compile(). */
interface CompiledPatterns {
  /** All patterns sorted longest-needle-first. */
  patterns: MaskerPattern[];
  /** Placeholder -> raw value map for unmask(). */
  placeholderToRaw: Map<string, string>;
  /** Whether the Aho-Corasick automaton is used. */
  usesAutomaton: boolean;
  /** Aho-Corasick root (undefined when not used). */
  automaton: AcNode | undefined;
}

// ---------------------------------------------------------------------------
// Aho-Corasick trie (minimal implementation)
// ---------------------------------------------------------------------------

interface AcNode {
  children: Map<number, AcNode>;
  fail: AcNode | undefined;
  /** Pattern indices that end at this node. */
  output: number[];
  depth: number;
}

function createAcNode(depth: number): AcNode {
  return { children: new Map(), fail: undefined, output: [], depth };
}

function buildAutomaton(patterns: MaskerPattern[]): AcNode {
  const root = createAcNode(0);
  root.fail = root;

  // Insert patterns into trie
  for (let pi = 0; pi < patterns.length; pi++) {
    let node = root;
    const needle = patterns[pi].needle;
    for (let i = 0; i < needle.length; i++) {
      const ch = needle.charCodeAt(i);
      let child = node.children.get(ch);
      if (!child) {
        child = createAcNode(node.depth + 1);
        node.children.set(ch, child);
      }
      node = child;
    }
    node.output.push(pi);
  }

  // BFS to build failure links
  const queue: AcNode[] = [];
  for (const child of root.children.values()) {
    child.fail = root;
    queue.push(child);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [ch, child] of current.children) {
      queue.push(child);
      let f = current.fail!;
      while (f !== root && !f.children.has(ch)) {
        f = f.fail!;
      }
      child.fail = f.children.get(ch) ?? root;
      if (child.fail === child) {
        child.fail = root;
      }
      // Merge output from fail chain (dictionary suffix links)
      child.output = child.output.concat(child.fail.output);
    }
  }

  return root;
}

interface AcMatch {
  patternIndex: number;
  start: number;
  end: number;
}

function searchAutomaton(root: AcNode, text: string): AcMatch[] {
  const matches: AcMatch[] = [];
  let node = root;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    while (node !== root && !node.children.has(ch)) {
      node = node.fail!;
    }
    node = node.children.get(ch) ?? root;

    for (const pi of node.output) {
      matches.push({ patternIndex: pi, start: i - node.depth + 1, end: i + 1 });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Placeholder generation
// ---------------------------------------------------------------------------

const PLACEHOLDER_PREFIX = "{{SECRET:";
const PLACEHOLDER_SUFFIX = "}}";

/** Generate the first 8 hex chars of SHA-256 for a raw secret value. */
function hash8(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 8);
}

/** Build the deterministic placeholder for a raw secret value. */
function makePlaceholder(raw: string): string {
  return `${PLACEHOLDER_PREFIX}${hash8(raw)}${PLACEHOLDER_SUFFIX}`;
}

// ---------------------------------------------------------------------------
// Multi-encoding expansion
// ---------------------------------------------------------------------------

function toBase64(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64");
}

function toUrlEncoded(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Expand a raw secret value into its encoding variants.
 * Each variant maps back to the same placeholder (derived from the raw value).
 */
function expandEncodings(name: string, raw: string): MaskerPattern[] {
  const placeholder = makePlaceholder(raw);
  const patterns: MaskerPattern[] = [];

  // Always add the raw form
  patterns.push({ needle: raw, placeholder, rawValue: raw, encoding: "raw" });

  // Base64 -- only add if it differs from raw
  const b64 = toBase64(raw);
  if (b64 !== raw) {
    patterns.push({ needle: b64, placeholder, rawValue: raw, encoding: "base64" });
  }

  // URL-encoded -- only add if it differs from raw
  const urlenc = toUrlEncoded(raw);
  if (urlenc !== raw) {
    patterns.push({ needle: urlenc, placeholder, rawValue: raw, encoding: "url" });
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Pattern compilation
// ---------------------------------------------------------------------------

/** Threshold for switching from sequential to Aho-Corasick. */
const AC_THRESHOLD = 10;

function compile(secrets: Map<string, string>): CompiledPatterns {
  const allPatterns: MaskerPattern[] = [];
  const placeholderToRaw = new Map<string, string>();

  for (const [name, value] of secrets) {
    const expanded = expandEncodings(name, value);
    for (const p of expanded) {
      allPatterns.push(p);
    }
    placeholderToRaw.set(makePlaceholder(value), value);
  }

  // Sort longest-first so longer needles take priority
  allPatterns.sort((a, b) => b.needle.length - a.needle.length);

  const usesAutomaton = allPatterns.length >= AC_THRESHOLD;
  const automaton = usesAutomaton ? buildAutomaton(allPatterns) : undefined;

  return { patterns: allPatterns, placeholderToRaw, usesAutomaton, automaton };
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

function maskSequential(text: string, patterns: MaskerPattern[]): string {
  if (patterns.length === 0 || text.length === 0) {
    return text;
  }

  let result = text;
  // Patterns are sorted longest-first, so longer matches take priority
  for (const p of patterns) {
    if (result.includes(p.needle)) {
      result = replaceAll(result, p.needle, p.placeholder);
    }
  }
  return result;
}

function maskAutomaton(text: string, compiled: CompiledPatterns): string {
  if (compiled.patterns.length === 0 || text.length === 0) {
    return text;
  }

  const matches = searchAutomaton(compiled.automaton!, text);
  if (matches.length === 0) {
    return text;
  }

  // Resolve overlaps: keep longest match at each position
  // Sort by start asc, then by length desc
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const parts: string[] = [];
  let cursor = 0;

  for (const m of matches) {
    if (m.start < cursor) {
      continue; // Overlapping -- skip
    }
    if (m.start > cursor) {
      parts.push(text.slice(cursor, m.start));
    }
    parts.push(compiled.patterns[m.patternIndex].placeholder);
    cursor = m.end;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts.join("");
}

/** Replace all occurrences of a literal string (no regex). */
function replaceAll(text: string, search: string, replacement: string): string {
  if (search.length === 0) {
    return text;
  }
  const parts: string[] = [];
  let start = 0;
  let idx = text.indexOf(search, start);
  while (idx !== -1) {
    parts.push(text.slice(start, idx));
    parts.push(replacement);
    start = idx + search.length;
    idx = text.indexOf(search, start);
  }
  parts.push(text.slice(start));
  return parts.join("");
}

// ---------------------------------------------------------------------------
// Unmasking
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{\{SECRET:[0-9a-f]{8}\}\}/g;

function unmaskText(text: string, placeholderToRaw: Map<string, string>): string {
  if (placeholderToRaw.size === 0 || text.length === 0) {
    return text;
  }
  return text.replace(PLACEHOLDER_RE, (match) => {
    const raw = placeholderToRaw.get(match);
    return raw !== undefined ? raw : match;
  });
}

// ---------------------------------------------------------------------------
// Public API: SecretsMasker
// ---------------------------------------------------------------------------

export interface SecretsMasker {
  /** Replace all registered secret values with {{SECRET:hash8}} placeholders. */
  mask(text: string): string;
  /** Restore {{SECRET:hash8}} placeholders to original secret values. */
  unmask(text: string): string;
  /** Number of individual patterns (including encoding variants). */
  readonly patternCount: number;
}

/**
 * Create a new masker from a name->value secret map.
 * The masker is immutable; call createMasker() again after registration changes.
 */
export function createMasker(secrets: Map<string, string>): SecretsMasker {
  const compiled = compile(secrets);

  return {
    mask(text: string): string {
      if (compiled.usesAutomaton) {
        return maskAutomaton(text, compiled);
      }
      return maskSequential(text, compiled.patterns);
    },

    unmask(text: string): string {
      return unmaskText(text, compiled.placeholderToRaw);
    },

    get patternCount(): number {
      return compiled.patterns.length;
    },
  };
}

// Re-export utility for testing
export { hash8 as computeHash8, makePlaceholder, expandEncodings };
export type { MaskerPattern, EncodingVariant, CompiledPatterns };
