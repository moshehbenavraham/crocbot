import { hashText } from "../../memory/internal.js";
import type { ImportSource, ParsedDocument } from "../types.js";
import type { DocumentParser, ParserHints } from "./parser.js";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const TITLE_KEY_RE = /^title:\s*['"]?(.+?)['"]?\s*$/m;
const FIRST_HEADING_RE = /^#{1,6}\s+(.+)$/m;

/** Extract title from YAML frontmatter or first heading. */
function extractTitle(content: string, source: ImportSource): string {
  // 1. Try YAML frontmatter title
  const fmMatch = FRONTMATTER_RE.exec(content);
  if (fmMatch) {
    const titleMatch = TITLE_KEY_RE.exec(fmMatch[1]);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
  }

  // 2. Try first heading
  const headingMatch = FIRST_HEADING_RE.exec(content);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // 3. Fallback to label or filename
  if (source.label) {
    return source.label;
  }
  const segments = source.value.replace(/\\/g, "/").split("/");
  return segments[segments.length - 1] || source.value;
}

/** Strip YAML frontmatter from markdown content. */
function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_RE, "").trimStart();
}

/** Create a markdown parser with frontmatter extraction and heading normalization. */
export function createMarkdownParser(): DocumentParser {
  return {
    id: "markdown",
    name: "Markdown Parser",
    contentTypes: ["markdown"],

    canParse(source: ImportSource, hints?: ParserHints): boolean {
      const ext = hints?.extension?.toLowerCase();
      if (ext === "md" || ext === "mdx") {
        return true;
      }

      if (source.type === "file") {
        const lower = source.value.toLowerCase();
        return lower.endsWith(".md") || lower.endsWith(".mdx");
      }

      return false;
    },

    async parse(
      source: ImportSource,
      raw: Buffer | string,
      _hints?: ParserHints,
    ): Promise<ParsedDocument> {
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      const rawByteLength = typeof raw === "string" ? Buffer.byteLength(raw, "utf-8") : raw.length;

      const title = extractTitle(text, source);
      const content = stripFrontmatter(text);

      return {
        title,
        content,
        contentHash: hashText(content),
        contentType: "markdown",
        source,
        rawByteLength,
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
