import { describe, expect, it } from "vitest";

import { hashText } from "../../memory/internal.js";
import type { ImportSource } from "../types.js";
import { createTextParser } from "./text-parser.js";

describe("createTextParser", () => {
  const parser = createTextParser();

  it("has correct metadata", () => {
    expect(parser.id).toBe("text");
    expect(parser.name).toBe("Plain Text Parser");
    expect(parser.contentTypes).toEqual(["text"]);
  });

  describe("canParse", () => {
    it("returns true for any source (universal fallback)", () => {
      const source: ImportSource = { type: "file", value: "/tmp/data.txt" };
      expect(parser.canParse(source)).toBe(true);
    });

    it("returns true for URL sources", () => {
      const source: ImportSource = { type: "url", value: "https://example.com" };
      expect(parser.canParse(source)).toBe(true);
    });

    it("returns true for unknown extensions", () => {
      const source: ImportSource = { type: "file", value: "/tmp/data.csv" };
      expect(parser.canParse(source, { extension: "csv" })).toBe(true);
    });
  });

  describe("parse", () => {
    it("wraps plain text content as-is", async () => {
      const source: ImportSource = { type: "file", value: "/docs/notes.txt" };
      const text = "Hello, world!\nThis is a test.";
      const result = await parser.parse(source, text);

      expect(result.content).toBe(text);
      expect(result.contentType).toBe("text");
      expect(result.title).toBe("notes.txt");
    });

    it("computes deterministic SHA-256 content hash", async () => {
      const source: ImportSource = { type: "file", value: "/tmp/test.txt" };
      const text = "deterministic content";

      const result1 = await parser.parse(source, text);
      const result2 = await parser.parse(source, text);

      expect(result1.contentHash).toBe(result2.contentHash);
      expect(result1.contentHash).toBe(hashText(text));
    });

    it("handles Buffer input", async () => {
      const source: ImportSource = { type: "file", value: "/tmp/binary.txt" };
      const buf = Buffer.from("buffer content", "utf-8");
      const result = await parser.parse(source, buf);

      expect(result.content).toBe("buffer content");
      expect(result.rawByteLength).toBe(buf.length);
    });

    it("sets rawByteLength correctly for string input", async () => {
      const source: ImportSource = { type: "file", value: "/tmp/test.txt" };
      const text = "hello";
      const result = await parser.parse(source, text);

      expect(result.rawByteLength).toBe(Buffer.byteLength(text, "utf-8"));
    });

    it("handles empty content", async () => {
      const source: ImportSource = { type: "file", value: "/tmp/empty.txt" };
      const result = await parser.parse(source, "");

      expect(result.content).toBe("");
      expect(result.rawByteLength).toBe(0);
      expect(result.contentHash).toBe(hashText(""));
    });

    it("uses label as title when provided", async () => {
      const source: ImportSource = {
        type: "file",
        value: "/tmp/data.txt",
        label: "My Document",
      };
      const result = await parser.parse(source, "content");

      expect(result.title).toBe("My Document");
    });

    it("derives title from URL hostname for URL sources", async () => {
      const source: ImportSource = {
        type: "url",
        value: "https://example.com/docs/page",
      };
      const result = await parser.parse(source, "content");

      expect(result.title).toBe("page");
    });

    it("produces ISO-8601 fetchedAt timestamp", async () => {
      const source: ImportSource = { type: "file", value: "/tmp/test.txt" };
      const result = await parser.parse(source, "content");

      expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("preserves source reference", async () => {
      const source: ImportSource = {
        type: "file",
        value: "/tmp/test.txt",
        metadata: { project: "demo" },
      };
      const result = await parser.parse(source, "content");

      expect(result.source).toBe(source);
    });
  });
});
