import { describe, expect, it } from "vitest";

import { markdownToTelegramHtml } from "./format.js";
import { renderMarkdownWithMarkers } from "../markdown/render.js";

describe("markdownToTelegramHtml", () => {
  it("renders basic inline formatting", () => {
    const res = markdownToTelegramHtml("hi _there_ **boss** `code`");
    expect(res).toBe("hi <i>there</i> <b>boss</b> <code>code</code>");
  });

  it("renders links as Telegram-safe HTML", () => {
    const res = markdownToTelegramHtml("see [docs](https://example.com)");
    expect(res).toBe('see <a href="https://example.com">docs</a>');
  });

  it("escapes raw HTML", () => {
    const res = markdownToTelegramHtml("<b>nope</b>");
    expect(res).toBe("&lt;b&gt;nope&lt;/b&gt;");
  });

  it("escapes unsafe characters", () => {
    const res = markdownToTelegramHtml("a & b < c");
    expect(res).toBe("a &amp; b &lt; c");
  });

  it("renders paragraphs with blank lines", () => {
    const res = markdownToTelegramHtml("first\n\nsecond");
    expect(res).toBe("first\n\nsecond");
  });

  it("renders lists without block HTML", () => {
    const res = markdownToTelegramHtml("- one\n- two");
    expect(res).toBe("• one\n• two");
  });

  it("renders ordered lists with numbering", () => {
    const res = markdownToTelegramHtml("2. two\n3. three");
    expect(res).toBe("2. two\n3. three");
  });

  it("renders headings as bold and blockquotes as blockquote tags", () => {
    const res = markdownToTelegramHtml("# Title\n\n> Quote");
    expect(res).toBe("<b>Title</b>\n\n<blockquote>Quote</blockquote>");
  });

  it("renders fenced code blocks", () => {
    const res = markdownToTelegramHtml("```js\nconst x = 1;\n```");
    expect(res).toBe("<pre><code>const x = 1;\n</code></pre>");
  });

  it("renders overlapping bold and link as valid nested HTML", () => {
    // Craft an IR where bold and link partially overlap
    const ir = {
      text: "hello world here",
      styles: [{ start: 0, end: 11, style: "bold" as const }],
      links: [{ start: 6, end: 16, href: "https://example.com" }],
    };
    const html = renderMarkdownWithMarkers(ir, {
      styleMarkers: {
        bold: { open: "<b>", close: "</b>" },
      },
      escapeText: (t: string) =>
        t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
      buildLink: (link) => ({
        start: link.start,
        end: link.end,
        open: `<a href="${link.href}">`,
        close: "</a>",
      }),
    });
    // Bold [0,11) + link [6,16) should be split so tags nest properly
    // Expected: <b>hello </b><a href="..."><b>world</b> here</a>
    expect(html).not.toMatch(/<b>[^<]*<a[^>]*>[^<]*<\/b>/);
    expect(html).not.toMatch(/<a[^>]*>[^<]*<\/b>[^<]*<\/a>/);
    // Verify the text content is preserved
    expect(html.replace(/<[^>]+>/g, "")).toBe("hello world here");
  });

  it("renders blockquote with inline formatting", () => {
    const res = markdownToTelegramHtml("> **bold** and _italic_");
    expect(res).toBe("<blockquote><b>bold</b> and <i>italic</i></blockquote>");
  });

  it("renders multi-line blockquote", () => {
    const res = markdownToTelegramHtml("> line one\n> line two");
    expect(res).toContain("<blockquote>");
    expect(res).toContain("line one");
    expect(res).toContain("line two");
    expect(res).toContain("</blockquote>");
  });
});
