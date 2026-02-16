import type { ImportSource } from "../types.js";
import { createMarkdownParser } from "./markdown-parser.js";
import type { DocumentParser, ParserHints } from "./parser.js";
import { createPdfParser } from "./pdf-parser.js";
import { createTextParser } from "./text-parser.js";
import { createUrlParser, type UrlParserDeps } from "./url-parser.js";

/** Registry that holds parsers in priority order and resolves the correct one for a source. */
export interface ParserRegistry {
  /** Register a parser. Later registrations with the same id replace earlier ones. */
  register(parser: DocumentParser): void;
  /** Find the first parser whose canParse() returns true, in registration order. */
  resolve(source: ImportSource, hints?: ParserHints): DocumentParser | null;
  /** Return all registered parsers in priority order. */
  list(): readonly DocumentParser[];
}

/** Create a ParserRegistry that dispatches in registration (priority) order. */
export function createParserRegistry(): ParserRegistry {
  const parsers: DocumentParser[] = [];

  return {
    register(parser: DocumentParser): void {
      const idx = parsers.findIndex((p) => p.id === parser.id);
      if (idx >= 0) {
        parsers[idx] = parser;
      } else {
        parsers.push(parser);
      }
    },

    resolve(source: ImportSource, hints?: ParserHints): DocumentParser | null {
      for (const parser of parsers) {
        if (parser.canParse(source, hints)) {
          return parser;
        }
      }
      return null;
    },

    list(): readonly DocumentParser[] {
      return [...parsers];
    },
  };
}

/**
 * Create a ParserRegistry pre-loaded with all four parsers in priority order:
 * 1. URL/HTML (matches type: "url")
 * 2. PDF (matches .pdf or application/pdf)
 * 3. Markdown (matches .md / .mdx)
 * 4. Text (universal fallback)
 */
export function createDefaultParserRegistry(deps: UrlParserDeps): ParserRegistry {
  const registry = createParserRegistry();
  registry.register(createUrlParser(deps));
  registry.register(createPdfParser());
  registry.register(createMarkdownParser());
  registry.register(createTextParser());
  return registry;
}
