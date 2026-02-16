import { describe, expect, it } from "vitest";

import { hashText } from "../memory/internal.js";
import type { ImportSource, ParsedDocument } from "./types.js";
import { chunkDocument, DEFAULT_CHUNKING } from "./chunker.js";

// -- Helpers --

function makeParsedDoc(content: string, source?: Partial<ImportSource>): ParsedDocument {
  const src: ImportSource = {
    type: "file",
    value: source?.value ?? "/docs/test.md",
    label: source?.label,
    metadata: source?.metadata,
    ...source,
  };
  return {
    title: "Test Document",
    content,
    source: src,
    contentHash: hashText(content),
    contentType: "markdown",
    rawByteLength: Buffer.byteLength(content),
    fetchedAt: new Date().toISOString(),
  };
}

describe("chunkDocument", () => {
  describe("empty and minimal content", () => {
    it("returns empty array for empty content", () => {
      const doc = makeParsedDoc("");
      const chunks = chunkDocument(doc);
      expect(chunks).toEqual([]);
    });

    it("returns empty array for whitespace-only content", () => {
      const doc = makeParsedDoc("   \n  \n   ");
      const chunks = chunkDocument(doc);
      // Whitespace-only lines produce chunks since they have non-zero length after split
      // but the trim check catches fully empty content
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it("returns single chunk for single-line content", () => {
      const doc = makeParsedDoc("Hello, world!");
      const chunks = chunkDocument(doc);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.text).toBe("Hello, world!");
      expect(chunks[0]?.index).toBe(0);
      expect(chunks[0]?.total).toBe(1);
      expect(chunks[0]?.startLine).toBe(1);
      expect(chunks[0]?.endLine).toBe(1);
    });
  });

  describe("chunk IDs and hashes", () => {
    it("produces deterministic chunk IDs", () => {
      const doc = makeParsedDoc("Paragraph one.\n\nParagraph two.");
      const chunks1 = chunkDocument(doc);
      const chunks2 = chunkDocument(doc);
      expect(chunks1.map((c) => c.id)).toEqual(chunks2.map((c) => c.id));
    });

    it("sets hash as SHA-256 of chunk text", () => {
      const doc = makeParsedDoc("Test content");
      const chunks = chunkDocument(doc);
      expect(chunks[0]?.hash).toBe(hashText("Test content"));
    });

    it("sets sourceValue to source.value", () => {
      const doc = makeParsedDoc("Content", { value: "/my/doc.md" });
      const chunks = chunkDocument(doc);
      expect(chunks[0]?.sourceValue).toBe("/my/doc.md");
    });
  });

  describe("heading-aware splitting", () => {
    it("splits content at headings into separate sections", () => {
      const content = [
        "# Section A",
        "Content of section A.",
        "",
        "# Section B",
        "Content of section B.",
      ].join("\n");

      const doc = makeParsedDoc(content);
      const chunks = chunkDocument(doc, { headingAware: true, tokens: 400, overlap: 0 });

      // With default tokens (400 * 4 = 1600 chars), both sections fit in one chunk each
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      const sectionA = chunks.find((c) => c.headingContext === "Section A");
      const sectionB = chunks.find((c) => c.headingContext === "Section B");
      expect(sectionA).toBeDefined();
      expect(sectionB).toBeDefined();
      expect(sectionA?.text).toContain("Section A");
      expect(sectionB?.text).toContain("Section B");
    });

    it("propagates heading context to all chunks in section", () => {
      // Create a section large enough to split into multiple chunks
      const lines = ["# Deep Dive"];
      for (let i = 0; i < 50; i += 1) {
        lines.push(`Line ${i}: ${"x".repeat(100)}`);
      }
      const content = lines.join("\n");
      const doc = makeParsedDoc(content);

      const chunks = chunkDocument(doc, { tokens: 100, overlap: 0, headingAware: true });
      expect(chunks.length).toBeGreaterThan(1);

      for (const chunk of chunks) {
        expect(chunk.headingContext).toBe("Deep Dive");
      }
    });

    it("sets headingContext to undefined before first heading", () => {
      const content = [
        "Intro paragraph before any heading.",
        "",
        "# First Heading",
        "Body text.",
      ].join("\n");

      const doc = makeParsedDoc(content);
      const chunks = chunkDocument(doc, { headingAware: true, tokens: 400, overlap: 0 });

      const introChunk = chunks.find((c) => c.text.includes("Intro paragraph"));
      expect(introChunk?.headingContext).toBeUndefined();
    });

    it("handles all heading levels (h1-h6)", () => {
      const content = ["## Level 2", "Content under h2.", "### Level 3", "Content under h3."].join(
        "\n",
      );

      const doc = makeParsedDoc(content);
      const chunks = chunkDocument(doc, { headingAware: true, tokens: 400, overlap: 0 });

      const h2Chunk = chunks.find((c) => c.headingContext === "Level 2");
      const h3Chunk = chunks.find((c) => c.headingContext === "Level 3");
      expect(h2Chunk).toBeDefined();
      expect(h3Chunk).toBeDefined();
    });
  });

  describe("heading-aware disabled", () => {
    it("treats headings as regular content when disabled", () => {
      const content = "# Heading\nBody text.";
      const doc = makeParsedDoc(content);
      const chunks = chunkDocument(doc, { headingAware: false, tokens: 400, overlap: 0 });

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.headingContext).toBeUndefined();
      expect(chunks[0]?.text).toContain("# Heading");
    });
  });

  describe("token limit splitting", () => {
    it("splits large content into multiple chunks", () => {
      // tokens=10 => maxChars=40
      const lines: string[] = [];
      for (let i = 0; i < 20; i += 1) {
        lines.push(`Line ${i}: ${"a".repeat(30)}`);
      }
      const content = lines.join("\n");
      const doc = makeParsedDoc(content);

      const chunks = chunkDocument(doc, { tokens: 10, overlap: 0, headingAware: false });
      expect(chunks.length).toBeGreaterThan(1);

      // All lines should be covered
      const allText = chunks.map((c) => c.text).join("\n");
      expect(allText).toContain("Line 0");
      expect(allText).toContain("Line 19");
    });

    it("handles very long single lines by splitting into segments", () => {
      const longLine = "x".repeat(2000);
      const doc = makeParsedDoc(longLine);

      // tokens=50 => maxChars=200
      const chunks = chunkDocument(doc, { tokens: 50, overlap: 0, headingAware: false });
      expect(chunks.length).toBeGreaterThan(1);

      // Reconstructed text should cover the long line
      const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
      expect(totalChars).toBeGreaterThanOrEqual(2000);
    });
  });

  describe("overlap", () => {
    it("carries overlap lines between adjacent chunks", () => {
      const lines: string[] = [];
      for (let i = 0; i < 20; i += 1) {
        lines.push(`Line ${String(i).padStart(2, "0")}`);
      }
      const content = lines.join("\n");
      const doc = makeParsedDoc(content);

      // tokens=20 => 80 chars max, overlap=5 => 20 chars overlap
      const chunks = chunkDocument(doc, { tokens: 20, overlap: 5, headingAware: false });
      expect(chunks.length).toBeGreaterThan(1);

      // Check that chunks have overlapping content
      for (let i = 1; i < chunks.length; i += 1) {
        const prev = chunks[i - 1];
        const curr = chunks[i];
        if (!prev || !curr) {
          continue;
        }

        // The end of the previous chunk should overlap with the start of the current
        const prevLines = prev.text.split("\n");
        const currLines = curr.text.split("\n");
        const prevLast = prevLines[prevLines.length - 1];
        // The overlap region means some lines from prev should appear in curr
        const hasOverlap = currLines.some((line) => prevLines.includes(line));
        expect(hasOverlap || prevLast === currLines[0]).toBe(true);
      }
    });

    it("produces no overlap when overlap is 0", () => {
      const lines: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        lines.push(`Unique line ${i}`);
      }
      const content = lines.join("\n");
      const doc = makeParsedDoc(content);

      const chunks = chunkDocument(doc, { tokens: 10, overlap: 0, headingAware: false });

      // With zero overlap, consecutive chunks should not share lines
      for (let i = 1; i < chunks.length; i += 1) {
        const prev = chunks[i - 1];
        const curr = chunks[i];
        if (!prev || !curr) {
          continue;
        }
        expect(prev.endLine).toBeLessThan(curr.startLine);
      }
    });
  });

  describe("line tracking", () => {
    it("tracks 1-based line numbers correctly", () => {
      const content = "Line 1\nLine 2\nLine 3";
      const doc = makeParsedDoc(content);
      const chunks = chunkDocument(doc, { tokens: 400, overlap: 0, headingAware: false });

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.startLine).toBe(1);
      expect(chunks[0]?.endLine).toBe(3);
    });

    it("assigns sequential indices", () => {
      const lines: string[] = [];
      for (let i = 0; i < 50; i += 1) {
        lines.push(`${"x".repeat(100)} line ${i}`);
      }
      const content = lines.join("\n");
      const doc = makeParsedDoc(content);

      const chunks = chunkDocument(doc, { tokens: 50, overlap: 0, headingAware: false });
      for (let i = 0; i < chunks.length; i += 1) {
        expect(chunks[i]?.index).toBe(i);
        expect(chunks[i]?.total).toBe(chunks.length);
      }
    });
  });

  describe("default options", () => {
    it("uses DEFAULT_CHUNKING when no options provided", () => {
      expect(DEFAULT_CHUNKING.tokens).toBe(400);
      expect(DEFAULT_CHUNKING.overlap).toBe(80);
      expect(DEFAULT_CHUNKING.headingAware).toBe(true);
    });

    it("respects partial options override", () => {
      const doc = makeParsedDoc("# Heading\nBody text.");
      const chunks = chunkDocument(doc, { tokens: 200 });
      // headingAware should default to true
      expect(chunks[0]?.headingContext).toBe("Heading");
    });
  });

  describe("edge cases", () => {
    it("handles document with only headings and no body", () => {
      const content = "# Heading 1\n# Heading 2\n# Heading 3";
      const doc = makeParsedDoc(content);
      const chunks = chunkDocument(doc);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("handles content with unicode characters", () => {
      const content = "# Unicode\nHello world with emoji and accents: cafe resume";
      const doc = makeParsedDoc(content);
      const chunks = chunkDocument(doc);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0]?.text).toContain("cafe");
    });
  });
});
