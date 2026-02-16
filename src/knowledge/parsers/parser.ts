import type { DocumentContentType, ImportSource, ParsedDocument } from "../types.js";

/** Hints provided to parsers for format detection. */
export interface ParserHints {
  /** HTTP Content-Type header value (for URL sources). */
  readonly contentType?: string;
  /** File extension without leading dot, lowercased (e.g. "pdf", "md"). */
  readonly extension?: string;
  /** Detected charset/encoding (e.g. "utf-8"). */
  readonly charset?: string;
}

/** Strategy interface for document format parsers. */
export interface DocumentParser {
  /** Unique identifier (e.g. "html", "pdf", "markdown", "text"). */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Content types this parser can produce. */
  readonly contentTypes: readonly DocumentContentType[];

  /** Return true if this parser can handle the given source and hints. */
  canParse(source: ImportSource, hints?: ParserHints): boolean;

  /** Parse raw content into a normalized ParsedDocument. */
  parse(source: ImportSource, raw: Buffer | string, hints?: ParserHints): Promise<ParsedDocument>;
}
