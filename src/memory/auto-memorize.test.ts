import { describe, expect, it, vi } from "vitest";

import {
  EXTRACTION_PROMPTS,
  SOLUTION_SYSTEM_PROMPT,
  FRAGMENT_SYSTEM_PROMPT,
  INSTRUMENT_SYSTEM_PROMPT,
  buildSolutionUserPrompt,
  buildFragmentUserPrompt,
  buildInstrumentUserPrompt,
  type ExtractionType,
} from "./auto-memorize-prompts.js";
import {
  parseTranscript,
  buildTranscriptText,
  clampImportance,
  parseExtractionResponse,
  parseSolutionItem,
  parseFragmentItem,
  parseInstrumentItem,
  runExtraction,
  storeExtractions,
  resolveConfig,
  runAutoMemorize,
  type AutoMemorizeDeps,
  type ExtractionResult,
} from "./auto-memorize.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDeps(overrides?: Partial<AutoMemorizeDeps>): AutoMemorizeDeps {
  return {
    callLlm: vi.fn().mockResolvedValue("[]"),
    embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    storeExtractedChunk: vi.fn().mockResolvedValue(undefined),
    checkBudget: vi.fn().mockReturnValue(true),
    getTranscript: vi
      .fn()
      .mockResolvedValue(
        '{"role":"user","content":"How do I fix OOM?"}\n' +
          '{"role":"assistant","content":"Increase memory limit to 2G."}',
      ),
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as AutoMemorizeDeps["log"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T017: Prompt building tests
// ---------------------------------------------------------------------------

describe("auto-memorize prompts", () => {
  describe("solution prompts", () => {
    it("system prompt contains JSON schema example", () => {
      expect(SOLUTION_SYSTEM_PROMPT).toContain('"problem"');
      expect(SOLUTION_SYSTEM_PROMPT).toContain('"solution"');
      expect(SOLUTION_SYSTEM_PROMPT).toContain('"context"');
      expect(SOLUTION_SYSTEM_PROMPT).toContain('"importance"');
    });

    it("system prompt instructs empty array on no results", () => {
      expect(SOLUTION_SYSTEM_PROMPT).toContain("empty array");
    });

    it("system prompt instructs valid JSON only", () => {
      expect(SOLUTION_SYSTEM_PROMPT).toContain("valid JSON only");
    });

    it("user prompt includes transcript text", () => {
      const prompt = buildSolutionUserPrompt("hello world");
      expect(prompt).toContain("hello world");
      expect(prompt).toContain("problem/solution");
    });
  });

  describe("fragment prompts", () => {
    it("system prompt contains JSON schema example", () => {
      expect(FRAGMENT_SYSTEM_PROMPT).toContain('"fact"');
      expect(FRAGMENT_SYSTEM_PROMPT).toContain('"category"');
      expect(FRAGMENT_SYSTEM_PROMPT).toContain('"importance"');
    });

    it("system prompt instructs empty array on no results", () => {
      expect(FRAGMENT_SYSTEM_PROMPT).toContain("empty array");
    });

    it("user prompt includes transcript text", () => {
      const prompt = buildFragmentUserPrompt("some facts");
      expect(prompt).toContain("some facts");
      expect(prompt).toContain("key facts");
    });
  });

  describe("instrument prompts", () => {
    it("system prompt contains JSON schema example", () => {
      expect(INSTRUMENT_SYSTEM_PROMPT).toContain('"name"');
      expect(INSTRUMENT_SYSTEM_PROMPT).toContain('"description"');
      expect(INSTRUMENT_SYSTEM_PROMPT).toContain('"type"');
      expect(INSTRUMENT_SYSTEM_PROMPT).toContain('"importance"');
    });

    it("system prompt instructs empty array on no results", () => {
      expect(INSTRUMENT_SYSTEM_PROMPT).toContain("empty array");
    });

    it("user prompt includes transcript text", () => {
      const prompt = buildInstrumentUserPrompt("used docker");
      expect(prompt).toContain("used docker");
      expect(prompt).toContain("tools, techniques");
    });
  });

  describe("extraction prompts registry", () => {
    it("has all three extraction types", () => {
      expect(EXTRACTION_PROMPTS).toHaveProperty("solutions");
      expect(EXTRACTION_PROMPTS).toHaveProperty("fragments");
      expect(EXTRACTION_PROMPTS).toHaveProperty("instruments");
    });

    it("each entry has systemPrompt, buildUserPrompt, and area", () => {
      for (const key of ["solutions", "fragments", "instruments"] as ExtractionType[]) {
        const entry = EXTRACTION_PROMPTS[key];
        expect(typeof entry.systemPrompt).toBe("string");
        expect(typeof entry.buildUserPrompt).toBe("function");
        expect(typeof entry.area).toBe("string");
      }
    });

    it("areas match expected values", () => {
      expect(EXTRACTION_PROMPTS.solutions.area).toBe("solutions");
      expect(EXTRACTION_PROMPTS.fragments.area).toBe("fragments");
      expect(EXTRACTION_PROMPTS.instruments.area).toBe("instruments");
    });
  });
});

// ---------------------------------------------------------------------------
// T018: JSON parsing and orchestration tests
// ---------------------------------------------------------------------------

describe("transcript parsing", () => {
  it("parses JSONL with user and assistant messages", () => {
    const raw = '{"role":"user","content":"Hello"}\n{"role":"assistant","content":"Hi there"}';
    const result = parseTranscript(raw);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "Hello" });
    expect(result[1]).toEqual({ role: "assistant", content: "Hi there" });
  });

  it("filters out system and tool messages", () => {
    const raw =
      '{"role":"system","content":"You are an assistant"}\n' +
      '{"role":"user","content":"Hello"}\n' +
      '{"role":"tool","content":"result"}\n' +
      '{"role":"assistant","content":"Hi"}';
    const result = parseTranscript(raw);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  it("skips empty content messages", () => {
    const raw = '{"role":"user","content":""}\n{"role":"assistant","content":"Hi"}';
    const result = parseTranscript(raw);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
  });

  it("handles empty transcript", () => {
    expect(parseTranscript("")).toHaveLength(0);
    expect(parseTranscript("\n\n")).toHaveLength(0);
  });

  it("handles malformed JSON lines gracefully", () => {
    const raw = 'not json\n{"role":"user","content":"Hello"}\n{broken';
    const result = parseTranscript(raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Hello");
  });

  it("handles missing content field", () => {
    const raw = '{"role":"user"}\n{"role":"assistant","content":"Hi"}';
    const result = parseTranscript(raw);
    // missing content field -> String(undefined) = "undefined" which is truthy but we check for it
    // Actually our code does String(obj["content"] ?? "") which is "" for missing, so it's filtered
    expect(result).toHaveLength(1);
  });
});

describe("transcript text building", () => {
  it("builds text from messages", () => {
    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];
    const text = buildTranscriptText(messages, 1000);
    expect(text).toBe("user: Hello\nassistant: Hi there");
  });

  it("truncates when exceeding maxChars", () => {
    const messages = [
      { role: "user", content: "A".repeat(100) },
      { role: "assistant", content: "B".repeat(100) },
    ];
    const text = buildTranscriptText(messages, 50);
    expect(text.length).toBeLessThanOrEqual(55); // 50 + "..."
    expect(text).toContain("user:");
  });

  it("handles empty messages array", () => {
    expect(buildTranscriptText([], 1000)).toBe("");
  });
});

describe("importance score clamping", () => {
  it("passes through valid values", () => {
    expect(clampImportance(0.5)).toBe(0.5);
    expect(clampImportance(0)).toBe(0);
    expect(clampImportance(1)).toBe(1);
  });

  it("clamps values below 0", () => {
    expect(clampImportance(-0.5)).toBe(0);
    expect(clampImportance(-100)).toBe(0);
  });

  it("clamps values above 1", () => {
    expect(clampImportance(1.5)).toBe(1);
    expect(clampImportance(100)).toBe(1);
  });

  it("defaults to 0.5 for non-finite values", () => {
    expect(clampImportance(NaN)).toBe(0.5);
    expect(clampImportance(Infinity)).toBe(0.5);
    expect(clampImportance(undefined)).toBe(0.5);
    expect(clampImportance("not a number")).toBe(0.5);
  });

  it("parses string numbers", () => {
    expect(clampImportance("0.7")).toBe(0.7);
  });
});

describe("extraction response parsing", () => {
  it("parses valid JSON array", () => {
    const result = parseExtractionResponse('[{"problem":"test","solution":"fix"}]');
    expect(result).toHaveLength(1);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseExtractionResponse("not json")).toHaveLength(0);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseExtractionResponse('{"key":"value"}')).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(parseExtractionResponse("")).toHaveLength(0);
  });

  it("handles empty JSON array", () => {
    expect(parseExtractionResponse("[]")).toHaveLength(0);
  });

  it("strips markdown code fences", () => {
    const result = parseExtractionResponse('```json\n[{"problem":"test","solution":"fix"}]\n```');
    expect(result).toHaveLength(1);
  });
});

describe("solution item parsing", () => {
  it("parses valid solution item", () => {
    const result = parseSolutionItem({
      problem: "OOM error",
      solution: "Increase memory",
      context: "Docker",
      importance: 0.8,
    });
    expect(result).toEqual({
      problem: "OOM error",
      solution: "Increase memory",
      context: "Docker",
      importance: 0.8,
    });
  });

  it("returns null for missing problem", () => {
    expect(parseSolutionItem({ solution: "fix" })).toBeNull();
  });

  it("returns null for missing solution", () => {
    expect(parseSolutionItem({ problem: "bug" })).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(parseSolutionItem("string")).toBeNull();
    expect(parseSolutionItem(null)).toBeNull();
    expect(parseSolutionItem(42)).toBeNull();
  });

  it("handles missing context as undefined", () => {
    const result = parseSolutionItem({
      problem: "bug",
      solution: "fix",
      importance: 0.5,
    });
    expect(result?.context).toBeUndefined();
  });

  it("clamps out-of-range importance", () => {
    const result = parseSolutionItem({
      problem: "bug",
      solution: "fix",
      importance: 2.0,
    });
    expect(result?.importance).toBe(1);
  });
});

describe("fragment item parsing", () => {
  it("parses valid fragment item", () => {
    const result = parseFragmentItem({
      fact: "User prefers TypeScript",
      category: "preference",
      importance: 0.7,
    });
    expect(result).toEqual({
      fact: "User prefers TypeScript",
      category: "preference",
      importance: 0.7,
    });
  });

  it("returns null for missing fact", () => {
    expect(parseFragmentItem({ category: "preference" })).toBeNull();
  });

  it("defaults category to 'fact'", () => {
    const result = parseFragmentItem({ fact: "something", importance: 0.5 });
    expect(result?.category).toBe("fact");
  });

  it("returns null for non-object", () => {
    expect(parseFragmentItem(null)).toBeNull();
  });
});

describe("instrument item parsing", () => {
  it("parses valid instrument item", () => {
    const result = parseInstrumentItem({
      name: "sqlite-vec",
      description: "Vector search extension",
      type: "tool",
      importance: 0.6,
    });
    expect(result).toEqual({
      name: "sqlite-vec",
      description: "Vector search extension",
      type: "tool",
      importance: 0.6,
    });
  });

  it("returns null for missing name", () => {
    expect(parseInstrumentItem({ description: "desc" })).toBeNull();
  });

  it("returns null for missing description", () => {
    expect(parseInstrumentItem({ name: "tool" })).toBeNull();
  });

  it("defaults type to 'tool'", () => {
    const result = parseInstrumentItem({
      name: "thing",
      description: "desc",
      importance: 0.5,
    });
    expect(result?.type).toBe("tool");
  });

  it("returns null for non-object", () => {
    expect(parseInstrumentItem(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Extraction runner tests
// ---------------------------------------------------------------------------

describe("extraction runner", () => {
  it("calls LLM with correct prompts and parses response", async () => {
    const callLlm = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify([{ problem: "OOM", solution: "Increase memory", importance: 0.8 }]),
      );
    const deps = createMockDeps({ callLlm });
    const result = await runExtraction("solutions", "test transcript", deps, 30_000);

    expect(result.type).toBe("solutions");
    expect(result.area).toBe("solutions");
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(false);
    expect(callLlm).toHaveBeenCalledOnce();
    expect(callLlm.mock.calls[0][0]).toHaveProperty("taskType", "consolidation");
  });

  it("skips when budget is exhausted", async () => {
    const deps = createMockDeps({ checkBudget: vi.fn().mockReturnValue(false) });
    const result = await runExtraction("solutions", "test", deps, 30_000);

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("rate_limit");
    expect(result.items).toHaveLength(0);
  });

  it("handles LLM returning empty array", async () => {
    const deps = createMockDeps({ callLlm: vi.fn().mockResolvedValue("[]") });
    const result = await runExtraction("fragments", "test", deps, 30_000);

    expect(result.items).toHaveLength(0);
    expect(result.skipped).toBe(false);
  });

  it("handles LLM returning malformed JSON", async () => {
    const deps = createMockDeps({
      callLlm: vi.fn().mockResolvedValue("not valid json"),
    });
    const result = await runExtraction("instruments", "test", deps, 30_000);

    expect(result.items).toHaveLength(0);
    expect(result.skipped).toBe(false);
  });

  it("filters out invalid items from LLM response", async () => {
    const deps = createMockDeps({
      callLlm: vi
        .fn()
        .mockResolvedValue(
          JSON.stringify([
            { problem: "valid", solution: "fix", importance: 0.5 },
            { problem: "missing solution" },
            null,
            "not an object",
          ]),
        ),
    });
    const result = await runExtraction("solutions", "test", deps, 30_000);

    expect(result.items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Storage integration tests
// ---------------------------------------------------------------------------

describe("storage integration", () => {
  it("stores all extracted items", async () => {
    const storeExtractedChunk = vi.fn().mockResolvedValue(undefined);
    const embedText = vi.fn().mockResolvedValue([0.1, 0.2]);
    const deps = createMockDeps({ storeExtractedChunk, embedText });

    const result: ExtractionResult = {
      type: "solutions",
      area: "solutions",
      items: [
        { problem: "bug", solution: "fix", importance: 0.8 },
        { problem: "crash", solution: "patch", importance: 0.6 },
      ],
      skipped: false,
    };

    const stored = await storeExtractions(result, deps);
    expect(stored).toBe(2);
    expect(storeExtractedChunk).toHaveBeenCalledTimes(2);
    expect(embedText).toHaveBeenCalledTimes(2);
  });

  it("stores fragments with correct text format", async () => {
    const storeExtractedChunk = vi.fn().mockResolvedValue(undefined);
    const deps = createMockDeps({ storeExtractedChunk });

    const result: ExtractionResult = {
      type: "fragments",
      area: "fragments",
      items: [{ fact: "User likes TypeScript", category: "preference", importance: 0.7 }],
      skipped: false,
    };

    await storeExtractions(result, deps);
    expect(storeExtractedChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "[preference] User likes TypeScript",
        area: "fragments",
        importance: 0.7,
      }),
    );
  });

  it("stores instruments with correct text format", async () => {
    const storeExtractedChunk = vi.fn().mockResolvedValue(undefined);
    const deps = createMockDeps({ storeExtractedChunk });

    const result: ExtractionResult = {
      type: "instruments",
      area: "instruments",
      items: [{ name: "Docker", description: "Container runtime", type: "tool", importance: 0.6 }],
      skipped: false,
    };

    await storeExtractions(result, deps);
    expect(storeExtractedChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "[tool] Docker: Container runtime",
        area: "instruments",
        importance: 0.6,
      }),
    );
  });

  it("continues on storage failure and logs warning", async () => {
    const storeExtractedChunk = vi
      .fn()
      .mockRejectedValueOnce(new Error("db error"))
      .mockResolvedValueOnce(undefined);
    const deps = createMockDeps({ storeExtractedChunk });

    const result: ExtractionResult = {
      type: "solutions",
      area: "solutions",
      items: [
        { problem: "a", solution: "b", importance: 0.5 },
        { problem: "c", solution: "d", importance: 0.5 },
      ],
      skipped: false,
    };

    const stored = await storeExtractions(result, deps);
    expect(stored).toBe(1);
    expect(deps.log.warn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T019: Config handling and orchestrator tests
// ---------------------------------------------------------------------------

describe("config resolution", () => {
  it("defaults to disabled", () => {
    expect(resolveConfig(undefined).enabled).toBe(false);
    expect(resolveConfig({}).enabled).toBe(false);
  });

  it("respects enabled flag", () => {
    expect(resolveConfig({ enabled: true }).enabled).toBe(true);
    expect(resolveConfig({ enabled: false }).enabled).toBe(false);
  });

  it("provides default maxTranscriptChars", () => {
    expect(resolveConfig(undefined).maxTranscriptChars).toBe(12_000);
  });

  it("provides default extractionTimeoutMs", () => {
    expect(resolveConfig(undefined).extractionTimeoutMs).toBe(30_000);
  });

  it("respects custom values", () => {
    const resolved = resolveConfig({
      enabled: true,
      maxTranscriptChars: 8000,
      extractionTimeoutMs: 15_000,
    });
    expect(resolved.maxTranscriptChars).toBe(8000);
    expect(resolved.extractionTimeoutMs).toBe(15_000);
  });
});

describe("orchestrator (runAutoMemorize)", () => {
  it("returns null when disabled", async () => {
    const deps = createMockDeps();
    const result = await runAutoMemorize("test-session", undefined, deps);
    expect(result).toBeNull();
  });

  it("returns null when explicitly disabled", async () => {
    const deps = createMockDeps();
    const result = await runAutoMemorize("test-session", { enabled: false }, deps);
    expect(result).toBeNull();
  });

  it("runs full pipeline when enabled", async () => {
    const callLlm = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify([{ problem: "OOM", solution: "More memory", importance: 0.8 }]),
      )
      .mockResolvedValueOnce(
        JSON.stringify([
          { fact: "User prefers 2G memory", category: "preference", importance: 0.6 },
        ]),
      )
      .mockResolvedValueOnce(
        JSON.stringify([
          { name: "Docker", description: "Container tool", type: "tool", importance: 0.5 },
        ]),
      );

    const deps = createMockDeps({ callLlm });
    const result = await runAutoMemorize("test-session", { enabled: true }, deps);

    expect(result).not.toBeNull();
    expect(result?.totalExtracted).toBe(3);
    expect(result?.totalStored).toBe(3);
    expect(result?.results).toHaveLength(3);
    expect(callLlm).toHaveBeenCalledTimes(3);
    expect(deps.storeExtractedChunk).toHaveBeenCalledTimes(3);
  });

  it("handles partial failure (one extraction type fails)", async () => {
    const callLlm = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify([{ problem: "a", solution: "b", importance: 0.5 }]))
      .mockRejectedValueOnce(new Error("LLM timeout"))
      .mockResolvedValueOnce("[]");

    const deps = createMockDeps({ callLlm });
    const result = await runAutoMemorize("test-session", { enabled: true }, deps);

    expect(result).not.toBeNull();
    expect(result?.totalExtracted).toBe(1);
    expect(result?.results).toHaveLength(3);

    const failed = result?.results.find((r) => r.error);
    expect(failed).toBeDefined();
    expect(failed?.type).toBe("fragments");
    expect(failed?.error).toContain("LLM timeout");
  });

  it("handles full skip when all extractions are rate-limited", async () => {
    const deps = createMockDeps({ checkBudget: vi.fn().mockReturnValue(false) });
    const result = await runAutoMemorize("test-session", { enabled: true }, deps);

    expect(result).not.toBeNull();
    expect(result?.totalExtracted).toBe(0);
    expect(result?.totalStored).toBe(0);
    for (const r of result?.results ?? []) {
      expect(r.skipped).toBe(true);
      expect(r.skipReason).toBe("rate_limit");
    }
  });

  it("returns empty result for empty transcript", async () => {
    const deps = createMockDeps({
      getTranscript: vi.fn().mockResolvedValue(""),
    });
    const result = await runAutoMemorize("test-session", { enabled: true }, deps);

    expect(result).not.toBeNull();
    expect(result?.totalExtracted).toBe(0);
    expect(result?.results).toHaveLength(0);
  });

  it("handles transcript with only system messages", async () => {
    const deps = createMockDeps({
      getTranscript: vi
        .fn()
        .mockResolvedValue(
          '{"role":"system","content":"You are helpful"}\n' +
            '{"role":"system","content":"Another system message"}',
        ),
    });
    const result = await runAutoMemorize("test-session", { enabled: true }, deps);

    expect(result).not.toBeNull();
    expect(result?.totalExtracted).toBe(0);
    expect(result?.results).toHaveLength(0);
  });

  it("returns null on transcript read failure", async () => {
    const deps = createMockDeps({
      getTranscript: vi.fn().mockRejectedValue(new Error("file not found")),
    });
    const result = await runAutoMemorize("test-session", { enabled: true }, deps);
    expect(result).toBeNull();
  });

  it("includes session ID and duration in result", async () => {
    const deps = createMockDeps({
      callLlm: vi.fn().mockResolvedValue("[]"),
    });
    const result = await runAutoMemorize("my-session-123", { enabled: true }, deps);

    expect(result?.sessionId).toBe("my-session-123");
    expect(result?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("logs extraction counts and completion", async () => {
    const deps = createMockDeps({
      callLlm: vi.fn().mockResolvedValue("[]"),
    });
    await runAutoMemorize("test-session", { enabled: true }, deps);

    expect(deps.log.info).toHaveBeenCalledWith(expect.stringContaining("auto-memorize: complete"));
    expect(deps.log.info).toHaveBeenCalledWith(expect.stringContaining("extracted=0"));
  });

  it("respects maxTranscriptChars config", async () => {
    const longContent = "A".repeat(200);
    const callLlm = vi.fn().mockResolvedValue("[]");
    const deps = createMockDeps({
      callLlm,
      getTranscript: vi.fn().mockResolvedValue(`{"role":"user","content":"${longContent}"}`),
    });
    await runAutoMemorize("test-session", { enabled: true, maxTranscriptChars: 50 }, deps);

    // The user prompt passed to callLlm should be truncated
    const firstCallArgs = callLlm.mock.calls[0][0] as { userPrompt: string };
    // The transcript portion should be limited
    expect(firstCallArgs.userPrompt.length).toBeLessThan(longContent.length + 200);
  });
});
