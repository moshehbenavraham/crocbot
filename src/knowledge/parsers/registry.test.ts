import { describe, expect, it, vi } from "vitest";

import type { ImportSource } from "../types.js";
import type { DocumentParser } from "./parser.js";
import { createDefaultParserRegistry, createParserRegistry } from "./registry.js";

/** Create a stub parser with configurable canParse behavior. */
function stubParser(
  id: string,
  canParseFn: (source: ImportSource) => boolean = () => false,
): DocumentParser {
  return {
    id,
    name: `${id} parser`,
    contentTypes: ["text"],
    canParse: canParseFn,
    parse: vi.fn().mockResolvedValue({
      title: "stub",
      content: "",
      contentHash: "abc",
      contentType: "text",
      source: { type: "file", value: "test" },
      rawByteLength: 0,
      fetchedAt: new Date().toISOString(),
    }),
  };
}

describe("createParserRegistry", () => {
  describe("register", () => {
    it("adds a parser to the registry", () => {
      const registry = createParserRegistry();
      const parser = stubParser("test");

      registry.register(parser);

      expect(registry.list()).toHaveLength(1);
      expect(registry.list()[0].id).toBe("test");
    });

    it("replaces a parser with the same id", () => {
      const registry = createParserRegistry();
      const parser1 = stubParser("test");
      const parser2 = stubParser("test");

      registry.register(parser1);
      registry.register(parser2);

      expect(registry.list()).toHaveLength(1);
      expect(registry.list()[0]).toBe(parser2);
    });

    it("maintains insertion order for different parsers", () => {
      const registry = createParserRegistry();

      registry.register(stubParser("first"));
      registry.register(stubParser("second"));
      registry.register(stubParser("third"));

      const ids = registry.list().map((p) => p.id);
      expect(ids).toEqual(["first", "second", "third"]);
    });
  });

  describe("resolve", () => {
    it("returns the first parser whose canParse returns true", () => {
      const registry = createParserRegistry();

      registry.register(stubParser("a", () => false));
      registry.register(stubParser("b", () => true));
      registry.register(stubParser("c", () => true));

      const source: ImportSource = { type: "file", value: "/test" };
      const resolved = registry.resolve(source);

      expect(resolved?.id).toBe("b");
    });

    it("returns null for empty registry", () => {
      const registry = createParserRegistry();
      const source: ImportSource = { type: "file", value: "/test" };

      expect(registry.resolve(source)).toBeNull();
    });

    it("returns null when no parser can handle the source", () => {
      const registry = createParserRegistry();
      registry.register(stubParser("a", () => false));

      const source: ImportSource = { type: "file", value: "/test" };
      expect(registry.resolve(source)).toBeNull();
    });

    it("respects priority ordering (first registered is checked first)", () => {
      const registry = createParserRegistry();
      const callOrder: string[] = [];

      registry.register(
        stubParser("high", (source) => {
          callOrder.push("high");
          return source.type === "url";
        }),
      );
      registry.register(
        stubParser("low", () => {
          callOrder.push("low");
          return true;
        }),
      );

      const source: ImportSource = { type: "url", value: "https://example.com" };
      const resolved = registry.resolve(source);

      expect(resolved?.id).toBe("high");
      expect(callOrder).toEqual(["high"]);
    });

    it("passes hints to canParse", () => {
      const registry = createParserRegistry();
      const canParseSpy = vi.fn().mockReturnValue(true);
      registry.register({ ...stubParser("test"), canParse: canParseSpy });

      const source: ImportSource = { type: "file", value: "/test" };
      const hints = { extension: "pdf" };
      registry.resolve(source, hints);

      expect(canParseSpy).toHaveBeenCalledWith(source, hints);
    });
  });

  describe("list", () => {
    it("returns empty array for new registry", () => {
      const registry = createParserRegistry();
      expect(registry.list()).toEqual([]);
    });

    it("returns a copy of the parsers array", () => {
      const registry = createParserRegistry();
      registry.register(stubParser("test"));

      const list1 = registry.list();
      const list2 = registry.list();

      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });
  });
});

describe("createDefaultParserRegistry", () => {
  it("registers all four parsers in priority order", () => {
    const deps = { fetch: vi.fn() };
    const registry = createDefaultParserRegistry(deps);

    const ids = registry.list().map((p) => p.id);
    expect(ids).toEqual(["html", "pdf", "markdown", "text"]);
  });

  it("routes URL sources to HTML parser", () => {
    const deps = { fetch: vi.fn() };
    const registry = createDefaultParserRegistry(deps);

    const source: ImportSource = { type: "url", value: "https://example.com" };
    expect(registry.resolve(source)?.id).toBe("html");
  });

  it("routes .pdf files to PDF parser", () => {
    const deps = { fetch: vi.fn() };
    const registry = createDefaultParserRegistry(deps);

    const source: ImportSource = { type: "file", value: "/docs/report.pdf" };
    expect(registry.resolve(source)?.id).toBe("pdf");
  });

  it("routes .md files to Markdown parser", () => {
    const deps = { fetch: vi.fn() };
    const registry = createDefaultParserRegistry(deps);

    const source: ImportSource = { type: "file", value: "/docs/readme.md" };
    expect(registry.resolve(source)?.id).toBe("markdown");
  });

  it("routes .mdx files to Markdown parser", () => {
    const deps = { fetch: vi.fn() };
    const registry = createDefaultParserRegistry(deps);

    const source: ImportSource = { type: "file", value: "/docs/page.mdx" };
    expect(registry.resolve(source)?.id).toBe("markdown");
  });

  it("routes .txt files to Text parser (fallback)", () => {
    const deps = { fetch: vi.fn() };
    const registry = createDefaultParserRegistry(deps);

    const source: ImportSource = { type: "file", value: "/docs/notes.txt" };
    expect(registry.resolve(source)?.id).toBe("text");
  });

  it("routes unknown extensions to Text parser (fallback)", () => {
    const deps = { fetch: vi.fn() };
    const registry = createDefaultParserRegistry(deps);

    const source: ImportSource = { type: "file", value: "/docs/data.csv" };
    expect(registry.resolve(source)?.id).toBe("text");
  });

  it("routes .pdf hint to PDF parser for ambiguous file", () => {
    const deps = { fetch: vi.fn() };
    const registry = createDefaultParserRegistry(deps);

    const source: ImportSource = { type: "file", value: "/docs/report" };
    expect(registry.resolve(source, { extension: "pdf" })?.id).toBe("pdf");
  });
});
