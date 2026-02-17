import { hashText } from "../../memory/internal.js";
import type { ImportSource, ParsedDocument } from "../types.js";
import type { DocumentParser, ParserHints } from "./parser.js";

/** Create a PDF parser using pdfjs-dist for page-by-page text extraction. */
export function createPdfParser(): DocumentParser {
  return {
    id: "pdf",
    name: "PDF Parser",
    contentTypes: ["pdf"],

    canParse(source: ImportSource, hints?: ParserHints): boolean {
      if (hints?.contentType?.includes("application/pdf")) {
        return true;
      }

      const ext = hints?.extension?.toLowerCase();
      if (ext === "pdf") {
        return true;
      }

      if (source.type === "file") {
        return source.value.toLowerCase().endsWith(".pdf");
      }

      if (source.type === "url") {
        try {
          const pathname = new URL(source.value).pathname.toLowerCase();
          return pathname.endsWith(".pdf");
        } catch {
          return false;
        }
      }

      return false;
    },

    async parse(
      source: ImportSource,
      raw: Buffer | string,
      _hints?: ParserHints,
    ): Promise<ParsedDocument> {
      const buf = typeof raw === "string" ? Buffer.from(raw, "utf-8") : raw;
      const rawByteLength = buf.length;

      // Dynamic import for pdfjs-dist (ESM compatible path for Node 22+)
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

      const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      // pdfjs-dist/legacy/build/pdf.mjs types don't expose the full
      // DocumentInitParameters; the runtime API does accept useSystemFonts.
      const doc = await getDocument({ data, useSystemFonts: true } as Parameters<
        typeof getDocument
      >[0]).promise;

      let title = "";
      try {
        // The .mjs entry point types omit getMetadata; cast to access it.
        const metadata = await (
          doc as unknown as { getMetadata(): Promise<{ info: Record<string, unknown> }> }
        ).getMetadata();
        const info = metadata?.info;
        if (info && typeof info.Title === "string" && info.Title.trim()) {
          title = info.Title.trim();
        }
      } catch {
        // Metadata extraction is best-effort
      }

      const pageTexts: string[] = [];
      const numPages = doc.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item: Record<string, unknown>) => typeof item.str === "string")
          .map((item: Record<string, unknown>) => item.str as string)
          .join("");
        pageTexts.push(pageText);
      }

      const content = pageTexts.join("\n\n---\n\n");

      // Fallback title: label, filename, or first line
      if (!title) {
        if (source.label) {
          title = source.label;
        } else {
          const segments = source.value.replace(/\\/g, "/").split("/");
          title = segments[segments.length - 1] || source.value;
        }
      }

      return {
        title,
        content,
        contentHash: hashText(content),
        contentType: "pdf",
        source,
        rawByteLength,
        fetchedAt: new Date().toISOString(),
        parserMeta: {
          pageCount: numPages,
        },
      };
    },
  };
}
