import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { hashText } from "../../memory/internal.js";
import type { ImportSource, ParsedDocument } from "../types.js";
import type { DocumentParser, ParserHints } from "./parser.js";

const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_TIMEOUT_MS = 30_000;

/** Dependency injection interface for the URL parser. */
export interface UrlParserDeps {
  /** SSRF-guarded fetch function. */
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Maximum response body size in bytes (default: 10MB). */
  readonly maxBodyBytes?: number;
  /** Fetch timeout in milliseconds (default: 30000). */
  readonly timeoutMs?: number;
}

/** Elements to strip before content extraction. */
const STRIP_SELECTORS = "nav, footer, header, aside, script, style, noscript, [role='navigation']";

/** Content selectors in priority order. */
const CONTENT_SELECTORS = ["article", "main", "[role='main']", "body"];

/** Extract the main content HTML from a parsed document. */
function extractMainContent($: cheerio.CheerioAPI): string {
  // Strip non-content elements
  $(STRIP_SELECTORS).remove();

  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector);
    if (el.length > 0) {
      return el.first().html() || "";
    }
  }

  return $.html() || "";
}

/** Read response body with byte limit enforcement. */
async function readBodyLimited(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is null");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error(`Response body exceeds ${maxBytes} bytes limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

/** Create a URL/HTML parser with SSRF-guarded fetch and cheerio content extraction. */
export function createUrlParser(deps: UrlParserDeps): DocumentParser {
  const maxBodyBytes = deps.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const nhm = new NodeHtmlMarkdown();

  return {
    id: "html",
    name: "URL/HTML Parser",
    contentTypes: ["html"],

    canParse(source: ImportSource, hints?: ParserHints): boolean {
      if (source.type === "url") {
        return true;
      }

      const ct = hints?.contentType?.toLowerCase() ?? "";
      return ct.includes("text/html") || ct.includes("application/xhtml");
    },

    async parse(
      source: ImportSource,
      raw: Buffer | string,
      _hints?: ParserHints,
    ): Promise<ParsedDocument> {
      let html: string;
      let rawByteLength: number;

      if (source.type === "url" && (raw === "" || (Buffer.isBuffer(raw) && raw.length === 0))) {
        // Fetch the URL content via SSRF-guarded fetch
        const signal = AbortSignal.timeout(timeoutMs);
        const response = await deps.fetch(source.value, { signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const bodyBuffer = await readBodyLimited(response, maxBodyBytes);
        rawByteLength = bodyBuffer.length;
        html = bodyBuffer.toString("utf-8");
      } else {
        // Raw content provided directly
        html = typeof raw === "string" ? raw : raw.toString("utf-8");
        rawByteLength = typeof raw === "string" ? Buffer.byteLength(raw, "utf-8") : raw.length;
      }

      // Parse with cheerio and extract main content
      const $ = cheerio.load(html);

      // Extract title from <title> tag
      const titleTag = $("title").first().text().trim();
      const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
      const title = ogTitle || titleTag || source.label || source.value;

      // Extract and convert main content to markdown
      const contentHtml = extractMainContent($);
      const content = nhm.translate(contentHtml).trim();

      return {
        title,
        content,
        contentHash: hashText(content),
        contentType: "html",
        source,
        rawByteLength,
        fetchedAt: new Date().toISOString(),
        parserMeta: {
          finalUrl: source.value,
          hadOgTitle: Boolean(ogTitle),
        },
      };
    },
  };
}
