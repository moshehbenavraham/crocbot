import { describe, expect, it } from "vitest";

import { hashText } from "../../memory/internal.js";
import type { ImportSource } from "../types.js";
import { createMarkdownParser } from "./markdown-parser.js";

describe("createMarkdownParser", () => {
  const parser = createMarkdownParser();

  it("has correct metadata", () => {
    expect(parser.id).toBe("markdown");
    expect(parser.name).toBe("Markdown Parser");
    expect(parser.contentTypes).toEqual(["markdown"]);
  });

  describe("canParse", () => {
    it("returns true for .md files", () => {
      const source: ImportSource = { type: "file", value: "/docs/readme.md" };
      expect(parser.canParse(source)).toBe(true);
    });

    it("returns true for .mdx files", () => {
      const source: ImportSource = { type: "file", value: "/docs/component.mdx" };
      expect(parser.canParse(source)).toBe(true);
    });

    it("returns true when hints indicate md extension", () => {
      const source: ImportSource = { type: "file", value: "/docs/file" };
      expect(parser.canParse(source, { extension: "md" })).toBe(true);
    });

    it("returns true when hints indicate mdx extension", () => {
      const source: ImportSource = { type: "file", value: "/docs/file" };
      expect(parser.canParse(source, { extension: "mdx" })).toBe(true);
    });

    it("returns false for non-markdown files", () => {
      const source: ImportSource = { type: "file", value: "/docs/file.txt" };
      expect(parser.canParse(source)).toBe(false);
    });

    it("returns false for URL sources without hints", () => {
      const source: ImportSource = { type: "url", value: "https://example.com/page" };
      expect(parser.canParse(source)).toBe(false);
    });
  });

  describe("parse", () => {
    it("extracts title from YAML frontmatter", async () => {
      const source: ImportSource = { type: "file", value: "/docs/test.md" };
      const content = `---
title: My Document Title
date: 2025-01-01
---

# Introduction

Some content here.`;

      const result = await parser.parse(source, content);
      expect(result.title).toBe("My Document Title");
    });

    it("extracts title from quoted frontmatter", async () => {
      const source: ImportSource = { type: "file", value: "/docs/test.md" };
      const content = `---
title: "Quoted Title"
---

Content.`;

      const result = await parser.parse(source, content);
      expect(result.title).toBe("Quoted Title");
    });

    it("falls back to first heading when no frontmatter title", async () => {
      const source: ImportSource = { type: "file", value: "/docs/test.md" };
      const content = `# First Heading

Some content.

## Second Heading`;

      const result = await parser.parse(source, content);
      expect(result.title).toBe("First Heading");
    });

    it("falls back to filename when no frontmatter or headings", async () => {
      const source: ImportSource = { type: "file", value: "/docs/notes.md" };
      const content = "Just some plain text without headings.";

      const result = await parser.parse(source, content);
      expect(result.title).toBe("notes.md");
    });

    it("uses label as fallback when no frontmatter or headings", async () => {
      const source: ImportSource = {
        type: "file",
        value: "/docs/notes.md",
        label: "Project Notes",
      };
      const content = "Just some plain text without headings.";

      const result = await parser.parse(source, content);
      expect(result.title).toBe("Project Notes");
    });

    it("strips frontmatter from output content", async () => {
      const source: ImportSource = { type: "file", value: "/docs/test.md" };
      const content = `---
title: Test
---

# Heading

Body text.`;

      const result = await parser.parse(source, content);
      expect(result.content).not.toContain("---");
      expect(result.content).toContain("# Heading");
      expect(result.content).toContain("Body text.");
    });

    it("passes through markdown content without frontmatter", async () => {
      const source: ImportSource = { type: "file", value: "/docs/test.md" };
      const content = "# Title\n\nSome **bold** text.";

      const result = await parser.parse(source, content);
      expect(result.content).toBe(content);
    });

    it("sets contentType to markdown", async () => {
      const source: ImportSource = { type: "file", value: "/docs/test.md" };
      const result = await parser.parse(source, "# Test");

      expect(result.contentType).toBe("markdown");
    });

    it("computes deterministic content hash on stripped content", async () => {
      const source: ImportSource = { type: "file", value: "/docs/test.md" };
      const content = `---
title: Test
---

# Heading

Body.`;

      const result = await parser.parse(source, content);
      const strippedContent = "# Heading\n\nBody.";
      expect(result.contentHash).toBe(hashText(strippedContent));
    });

    it("handles Buffer input", async () => {
      const source: ImportSource = { type: "file", value: "/docs/test.md" };
      const buf = Buffer.from("# Buffer Title\n\nContent.", "utf-8");
      const result = await parser.parse(source, buf);

      expect(result.title).toBe("Buffer Title");
      expect(result.rawByteLength).toBe(buf.length);
    });

    it("handles empty content", async () => {
      const source: ImportSource = { type: "file", value: "/docs/empty.md" };
      const result = await parser.parse(source, "");

      expect(result.content).toBe("");
      expect(result.title).toBe("empty.md");
      expect(result.rawByteLength).toBe(0);
    });
  });
});
