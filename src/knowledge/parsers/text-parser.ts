import { hashText } from "../../memory/internal.js";
import type { ImportSource, ParsedDocument } from "../types.js";
import type { DocumentParser, ParserHints } from "./parser.js";

/** Derive a title from the source value (filename or last URL path segment). */
function deriveTitle(source: ImportSource): string {
  if (source.label) {
    return source.label;
  }

  const value = source.value;
  if (source.type === "file") {
    const segments = value.replace(/\\/g, "/").split("/");
    return segments[segments.length - 1] || value;
  }

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || url.hostname;
  } catch {
    return value;
  }
}

/** Create a plain text fallback parser. */
export function createTextParser(): DocumentParser {
  return {
    id: "text",
    name: "Plain Text Parser",
    contentTypes: ["text"],

    canParse(_source: ImportSource, _hints?: ParserHints): boolean {
      // Text parser is the universal fallback -- always returns true.
      return true;
    },

    async parse(
      source: ImportSource,
      raw: Buffer | string,
      _hints?: ParserHints,
    ): Promise<ParsedDocument> {
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      const rawByteLength = typeof raw === "string" ? Buffer.byteLength(raw, "utf-8") : raw.length;

      return {
        title: deriveTitle(source),
        content: text,
        contentHash: hashText(text),
        contentType: "text",
        source,
        rawByteLength,
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
