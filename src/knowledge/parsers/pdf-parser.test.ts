import { describe, expect, it, vi } from "vitest";

import type { ImportSource } from "../types.js";
import { createPdfParser } from "./pdf-parser.js";

// Mock pdfjs-dist to avoid needing real PDF buffers in unit tests
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: (_opts: { data: Uint8Array }) => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: (num: number) =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({
              items: [{ str: `Page ${num} text line 1. ` }, { str: `Page ${num} text line 2.` }],
            }),
        }),
      getMetadata: () =>
        Promise.resolve({
          info: { Title: "Mock PDF Title" },
        }),
    }),
  }),
}));

describe("createPdfParser", () => {
  const parser = createPdfParser();

  it("has correct metadata", () => {
    expect(parser.id).toBe("pdf");
    expect(parser.name).toBe("PDF Parser");
    expect(parser.contentTypes).toEqual(["pdf"]);
  });

  describe("canParse", () => {
    it("returns true for .pdf file extension", () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      expect(parser.canParse(source)).toBe(true);
    });

    it("returns true when hints have pdf extension", () => {
      const source: ImportSource = { type: "file", value: "/docs/report" };
      expect(parser.canParse(source, { extension: "pdf" })).toBe(true);
    });

    it("returns true for application/pdf content type", () => {
      const source: ImportSource = { type: "file", value: "/docs/report" };
      expect(parser.canParse(source, { contentType: "application/pdf" })).toBe(true);
    });

    it("returns true for URL sources with .pdf path", () => {
      const source: ImportSource = {
        type: "url",
        value: "https://example.com/docs/report.pdf",
      };
      expect(parser.canParse(source)).toBe(true);
    });

    it("returns false for non-PDF files", () => {
      const source: ImportSource = { type: "file", value: "/docs/notes.txt" };
      expect(parser.canParse(source)).toBe(false);
    });

    it("returns false for URL sources without .pdf path", () => {
      const source: ImportSource = {
        type: "url",
        value: "https://example.com/page",
      };
      expect(parser.canParse(source)).toBe(false);
    });
  });

  describe("parse", () => {
    it("extracts text from all pages with separators", async () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      const buf = Buffer.from("mock pdf content");

      const result = await parser.parse(source, buf);

      expect(result.content).toContain("Page 1 text line 1.");
      expect(result.content).toContain("Page 2 text line 2.");
      expect(result.content).toContain("\n\n---\n\n");
    });

    it("extracts title from PDF metadata", async () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      const result = await parser.parse(source, Buffer.from("mock"));

      expect(result.title).toBe("Mock PDF Title");
    });

    it("sets contentType to pdf", async () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      const result = await parser.parse(source, Buffer.from("mock"));

      expect(result.contentType).toBe("pdf");
    });

    it("includes pageCount in parserMeta", async () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      const result = await parser.parse(source, Buffer.from("mock"));

      expect(result.parserMeta?.pageCount).toBe(2);
    });

    it("sets rawByteLength from buffer", async () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      const buf = Buffer.from("twelve bytes");
      const result = await parser.parse(source, buf);

      expect(result.rawByteLength).toBe(buf.length);
    });

    it("preserves source reference", async () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      const result = await parser.parse(source, Buffer.from("mock"));

      expect(result.source).toBe(source);
    });

    it("produces ISO-8601 fetchedAt timestamp", async () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      const result = await parser.parse(source, Buffer.from("mock"));

      expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("converts string input to buffer", async () => {
      const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
      const result = await parser.parse(source, "string content");

      // Should not throw -- string input is converted to buffer
      expect(result.contentType).toBe("pdf");
    });
  });
});
