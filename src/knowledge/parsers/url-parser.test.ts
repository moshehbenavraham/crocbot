import { describe, expect, it, vi } from "vitest";

import type { ImportSource } from "../types.js";
import { createUrlParser, type UrlParserDeps } from "./url-parser.js";

/** Helper: create a mock Response with the given HTML body. */
function mockResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    statusText: status === 200 ? "OK" : "Not Found",
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Helper: create deps with a mock fetch that returns the given HTML. */
function mockDeps(html: string, status = 200): UrlParserDeps {
  return {
    fetch: vi.fn().mockResolvedValue(mockResponse(html, status)),
  };
}

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <nav><a href="/">Home</a></nav>
  <header><h1>Site Header</h1></header>
  <article>
    <h2>Article Title</h2>
    <p>Main content paragraph.</p>
  </article>
  <footer>Footer content</footer>
</body>
</html>`;

describe("createUrlParser", () => {
  const deps = mockDeps(SAMPLE_HTML);
  const parser = createUrlParser(deps);

  it("has correct metadata", () => {
    expect(parser.id).toBe("html");
    expect(parser.name).toBe("URL/HTML Parser");
    expect(parser.contentTypes).toEqual(["html"]);
  });

  describe("canParse", () => {
    it("returns true for URL sources", () => {
      const source: ImportSource = { type: "url", value: "https://example.com" };
      expect(parser.canParse(source)).toBe(true);
    });

    it("returns false for file sources without HTML hints", () => {
      const source: ImportSource = { type: "file", value: "/docs/file.txt" };
      expect(parser.canParse(source)).toBe(false);
    });

    it("returns true for file sources with text/html content type hint", () => {
      const source: ImportSource = { type: "file", value: "/docs/page.html" };
      expect(parser.canParse(source, { contentType: "text/html" })).toBe(true);
    });

    it("returns true for file sources with xhtml content type hint", () => {
      const source: ImportSource = { type: "file", value: "/docs/page.xhtml" };
      expect(parser.canParse(source, { contentType: "application/xhtml+xml" })).toBe(true);
    });
  });

  describe("parse with raw HTML content", () => {
    it("extracts title from <title> tag", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const result = await parser.parse(source, SAMPLE_HTML);

      expect(result.title).toBe("Test Page");
    });

    it("prefers og:title over <title>", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const html = `<html><head>
        <title>Page Title</title>
        <meta property="og:title" content="OG Title">
      </head><body><p>Content.</p></body></html>`;

      const result = await parser.parse(source, html);
      expect(result.title).toBe("OG Title");
    });

    it("extracts content from article element", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const result = await parser.parse(source, SAMPLE_HTML);

      expect(result.content).toContain("Article Title");
      expect(result.content).toContain("Main content paragraph.");
    });

    it("strips nav, footer, header, aside elements", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const result = await parser.parse(source, SAMPLE_HTML);

      expect(result.content).not.toContain("Home");
      expect(result.content).not.toContain("Site Header");
      expect(result.content).not.toContain("Footer content");
    });

    it("falls back to main when no article", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const html = `<html><head><title>Test</title></head>
        <body><main><p>Main content.</p></main></body></html>`;

      const result = await parser.parse(source, html);
      expect(result.content).toContain("Main content.");
    });

    it("falls back to body when no article or main", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const html = `<html><head><title>Test</title></head>
        <body><p>Body content.</p></body></html>`;

      const result = await parser.parse(source, html);
      expect(result.content).toContain("Body content.");
    });

    it("converts HTML to markdown", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const html = `<html><head><title>Test</title></head>
        <body><article><h2>Heading</h2><p>Paragraph with <strong>bold</strong>.</p></article></body></html>`;

      const result = await parser.parse(source, html);
      expect(result.content).toContain("**bold**");
    });

    it("sets contentType to html", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com" };
      const result = await parser.parse(source, SAMPLE_HTML);

      expect(result.contentType).toBe("html");
    });

    it("computes deterministic content hash", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com" };
      const result1 = await parser.parse(source, SAMPLE_HTML);
      const result2 = await parser.parse(source, SAMPLE_HTML);

      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it("sets rawByteLength from string input", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com" };
      const result = await parser.parse(source, SAMPLE_HTML);

      expect(result.rawByteLength).toBe(Buffer.byteLength(SAMPLE_HTML, "utf-8"));
    });

    it("produces ISO-8601 fetchedAt", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com" };
      const result = await parser.parse(source, SAMPLE_HTML);

      expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("parse with fetch", () => {
    it("fetches URL content when raw is empty string", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockResponse(SAMPLE_HTML));
      const fetchParser = createUrlParser({ fetch: fetchFn });

      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const result = await fetchParser.parse(source, "");

      expect(fetchFn).toHaveBeenCalledWith(
        "https://example.com/page",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(result.title).toBe("Test Page");
    });

    it("fetches URL content when raw is empty buffer", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockResponse(SAMPLE_HTML));
      const fetchParser = createUrlParser({ fetch: fetchFn });

      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const result = await fetchParser.parse(source, Buffer.alloc(0));

      expect(fetchFn).toHaveBeenCalled();
      expect(result.title).toBe("Test Page");
    });

    it("throws on non-200 HTTP response", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockResponse("", 404));
      const fetchParser = createUrlParser({ fetch: fetchFn });

      const source: ImportSource = { type: "url", value: "https://example.com/missing" };

      await expect(fetchParser.parse(source, "")).rejects.toThrow("HTTP 404");
    });

    it("does not fetch when raw content is provided", async () => {
      const fetchFn = vi.fn();
      const fetchParser = createUrlParser({ fetch: fetchFn });

      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      await fetchParser.parse(source, SAMPLE_HTML);

      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles HTML with no title tag", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      const html = "<html><body><p>No title.</p></body></html>";

      const result = await parser.parse(source, html);
      expect(result.title).toBe("https://example.com/page");
    });

    it("handles Buffer input for HTML content", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com" };
      const html = "<html><head><title>Buf</title></head><body><p>Content.</p></body></html>";
      const buf = Buffer.from(html, "utf-8");

      const result = await parser.parse(source, buf);
      expect(result.title).toBe("Buf");
      expect(result.rawByteLength).toBe(buf.length);
    });

    it("strips script and style elements", async () => {
      const source: ImportSource = { type: "url", value: "https://example.com" };
      const html = `<html><head><title>T</title></head><body>
        <script>alert('xss')</script>
        <style>.hidden{display:none}</style>
        <p>Visible content.</p>
      </body></html>`;

      const result = await parser.parse(source, html);
      expect(result.content).not.toContain("alert");
      expect(result.content).not.toContain(".hidden");
      expect(result.content).toContain("Visible content.");
    });
  });
});
