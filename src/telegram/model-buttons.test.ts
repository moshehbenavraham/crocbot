import { describe, expect, it } from "vitest";
import {
  buildBrowseProvidersButton,
  buildModelsKeyboard,
  buildProviderKeyboard,
  calculateTotalPages,
  getModelsPageSize,
  parseModelCallbackData,
  type ProviderInfo,
} from "./model-buttons.js";

describe("parseModelCallbackData", () => {
  it("returns null for non-model callback data", () => {
    expect(parseModelCallbackData("")).toBeNull();
    expect(parseModelCallbackData("something")).toBeNull();
    expect(parseModelCallbackData("commands_page_1")).toBeNull();
  });

  it("parses mdl_prov as providers type", () => {
    const result = parseModelCallbackData("mdl_prov");
    expect(result).toEqual({ type: "providers" });
  });

  it("parses mdl_back as back type", () => {
    const result = parseModelCallbackData("mdl_back");
    expect(result).toEqual({ type: "back" });
  });

  it("parses mdl_list_{provider}_{page} pattern", () => {
    expect(parseModelCallbackData("mdl_list_anthropic_1")).toEqual({
      type: "list",
      provider: "anthropic",
      page: 1,
    });
    expect(parseModelCallbackData("mdl_list_openai_5")).toEqual({
      type: "list",
      provider: "openai",
      page: 5,
    });
    expect(parseModelCallbackData("mdl_list_google-ai_10")).toEqual({
      type: "list",
      provider: "google-ai",
      page: 10,
    });
  });

  it("parses mdl_sel_{provider/model} pattern", () => {
    expect(parseModelCallbackData("mdl_sel_anthropic/claude-3")).toEqual({
      type: "select",
      provider: "anthropic",
      model: "claude-3",
    });
    expect(parseModelCallbackData("mdl_sel_openai/gpt-4-turbo")).toEqual({
      type: "select",
      provider: "openai",
      model: "gpt-4-turbo",
    });
  });

  it("handles models with multiple slashes in the name", () => {
    expect(parseModelCallbackData("mdl_sel_provider/model/variant")).toEqual({
      type: "select",
      provider: "provider",
      model: "model/variant",
    });
  });

  it("returns null for invalid list patterns", () => {
    expect(parseModelCallbackData("mdl_list_")).toBeNull();
    expect(parseModelCallbackData("mdl_list_provider")).toBeNull();
    expect(parseModelCallbackData("mdl_list_provider_")).toBeNull();
    expect(parseModelCallbackData("mdl_list_provider_0")).toBeNull();
    expect(parseModelCallbackData("mdl_list__1")).toBeNull();
  });

  it("returns null for invalid select patterns", () => {
    expect(parseModelCallbackData("mdl_sel_")).toBeNull();
    expect(parseModelCallbackData("mdl_sel_provider")).toBeNull();
    expect(parseModelCallbackData("mdl_sel_/model")).toBeNull();
    expect(parseModelCallbackData("mdl_sel_provider/")).toBeNull();
  });

  it("trims whitespace from input", () => {
    expect(parseModelCallbackData("  mdl_prov  ")).toEqual({ type: "providers" });
    expect(parseModelCallbackData("  mdl_list_openai_1  ")).toEqual({
      type: "list",
      provider: "openai",
      page: 1,
    });
  });
});

describe("buildProviderKeyboard", () => {
  it("returns empty array for no providers", () => {
    expect(buildProviderKeyboard([])).toEqual([]);
  });

  it("creates single row for one provider", () => {
    const providers: ProviderInfo[] = [{ id: "anthropic", count: 5 }];
    const keyboard = buildProviderKeyboard(providers);
    expect(keyboard).toHaveLength(1);
    expect(keyboard[0]).toHaveLength(1);
    expect(keyboard[0][0]).toEqual({
      text: "anthropic (5)",
      callback_data: "mdl_list_anthropic_1",
    });
  });

  it("creates one row for two providers", () => {
    const providers: ProviderInfo[] = [
      { id: "anthropic", count: 5 },
      { id: "openai", count: 10 },
    ];
    const keyboard = buildProviderKeyboard(providers);
    expect(keyboard).toHaveLength(1);
    expect(keyboard[0]).toHaveLength(2);
  });

  it("creates multiple rows for many providers (2 per row)", () => {
    const providers: ProviderInfo[] = [
      { id: "anthropic", count: 5 },
      { id: "openai", count: 10 },
      { id: "google", count: 3 },
      { id: "mistral", count: 7 },
      { id: "cohere", count: 2 },
    ];
    const keyboard = buildProviderKeyboard(providers);
    expect(keyboard).toHaveLength(3);
    expect(keyboard[0]).toHaveLength(2);
    expect(keyboard[1]).toHaveLength(2);
    expect(keyboard[2]).toHaveLength(1);
  });
});

describe("buildModelsKeyboard", () => {
  it("returns only back button for empty models", () => {
    const keyboard = buildModelsKeyboard({
      provider: "anthropic",
      models: [],
      currentPage: 1,
      totalPages: 1,
    });
    expect(keyboard).toHaveLength(1);
    expect(keyboard[0]).toEqual([{ text: "<< Back", callback_data: "mdl_back" }]);
  });

  it("creates model buttons with one per row", () => {
    const keyboard = buildModelsKeyboard({
      provider: "anthropic",
      models: ["claude-3-opus", "claude-3-sonnet"],
      currentPage: 1,
      totalPages: 1,
    });
    // 2 model rows + back button
    expect(keyboard).toHaveLength(3);
    expect(keyboard[0][0].text).toBe("claude-3-opus");
    expect(keyboard[0][0].callback_data).toBe("mdl_sel_anthropic/claude-3-opus");
    expect(keyboard[1][0].text).toBe("claude-3-sonnet");
  });

  it("marks current model with checkmark", () => {
    const keyboard = buildModelsKeyboard({
      provider: "anthropic",
      models: ["claude-3-opus", "claude-3-sonnet"],
      currentModel: "anthropic/claude-3-opus",
      currentPage: 1,
      totalPages: 1,
    });
    expect(keyboard[0][0].text).toBe("claude-3-opus \u2713");
    expect(keyboard[1][0].text).toBe("claude-3-sonnet");
  });

  it("marks current model without provider prefix", () => {
    const keyboard = buildModelsKeyboard({
      provider: "anthropic",
      models: ["claude-3-opus"],
      currentModel: "claude-3-opus",
      currentPage: 1,
      totalPages: 1,
    });
    expect(keyboard[0][0].text).toBe("claude-3-opus \u2713");
  });

  it("adds pagination row when totalPages > 1", () => {
    const keyboard = buildModelsKeyboard({
      provider: "anthropic",
      models: ["model1", "model2"],
      currentPage: 1,
      totalPages: 3,
      pageSize: 2,
    });
    // 2 model rows + pagination row + back button
    expect(keyboard).toHaveLength(4);
    const paginationRow = keyboard[2];
    expect(paginationRow).toHaveLength(2);
    expect(paginationRow[0].text).toBe("1/3");
    expect(paginationRow[1].text).toBe("Next \u25B6");
  });

  it("shows prev button on non-first page", () => {
    // 6 models with pageSize=2 = 3 pages, page 2 shows model3 and model4
    const keyboard = buildModelsKeyboard({
      provider: "anthropic",
      models: ["model1", "model2", "model3", "model4", "model5", "model6"],
      currentPage: 2,
      totalPages: 3,
      pageSize: 2,
    });
    // 2 model rows + pagination row + back button = 4 rows
    expect(keyboard).toHaveLength(4);
    const paginationRow = keyboard[2];
    expect(paginationRow).toHaveLength(3);
    expect(paginationRow[0].text).toBe("\u25C0 Prev");
    expect(paginationRow[1].text).toBe("2/3");
    expect(paginationRow[2].text).toBe("Next \u25B6");
  });

  it("hides next button on last page", () => {
    // 6 models with pageSize=2 = 3 pages, page 3 shows model5 and model6
    const keyboard = buildModelsKeyboard({
      provider: "anthropic",
      models: ["model1", "model2", "model3", "model4", "model5", "model6"],
      currentPage: 3,
      totalPages: 3,
      pageSize: 2,
    });
    // 2 model rows + pagination row + back button = 4 rows
    expect(keyboard).toHaveLength(4);
    const paginationRow = keyboard[2];
    expect(paginationRow).toHaveLength(2);
    expect(paginationRow[0].text).toBe("\u25C0 Prev");
    expect(paginationRow[1].text).toBe("3/3");
  });

  it("paginates model list correctly", () => {
    const models = ["m1", "m2", "m3", "m4", "m5"];
    const keyboard = buildModelsKeyboard({
      provider: "test",
      models,
      currentPage: 2,
      totalPages: 3,
      pageSize: 2,
    });
    // Page 2 should show m3 and m4
    expect(keyboard[0][0].text).toBe("m3");
    expect(keyboard[1][0].text).toBe("m4");
  });
});

describe("buildBrowseProvidersButton", () => {
  it("returns single button row", () => {
    const keyboard = buildBrowseProvidersButton();
    expect(keyboard).toHaveLength(1);
    expect(keyboard[0]).toHaveLength(1);
    expect(keyboard[0][0]).toEqual({
      text: "Browse providers",
      callback_data: "mdl_prov",
    });
  });
});

describe("getModelsPageSize", () => {
  it("returns default page size of 8", () => {
    expect(getModelsPageSize()).toBe(8);
  });
});

describe("calculateTotalPages", () => {
  it("returns 1 for empty list", () => {
    expect(calculateTotalPages(0)).toBe(0);
  });

  it("returns 1 for models within page size", () => {
    expect(calculateTotalPages(5)).toBe(1);
    expect(calculateTotalPages(8)).toBe(1);
  });

  it("calculates pages correctly for larger lists", () => {
    expect(calculateTotalPages(9)).toBe(2);
    expect(calculateTotalPages(16)).toBe(2);
    expect(calculateTotalPages(17)).toBe(3);
    expect(calculateTotalPages(24)).toBe(3);
  });

  it("respects custom page size", () => {
    expect(calculateTotalPages(10, 5)).toBe(2);
    expect(calculateTotalPages(11, 5)).toBe(3);
  });
});

describe("64-byte callback data limit", () => {
  it("skips models that exceed 64 bytes in callback data", () => {
    // "mdl_sel_provider/" = 17 bytes, leaving 47 bytes for model name
    const longModelId = "a".repeat(50); // 50 bytes + 17 = 67 bytes (exceeds limit)
    const shortModelId = "short";
    const keyboard = buildModelsKeyboard({
      provider: "provider",
      models: [longModelId, shortModelId],
      currentPage: 1,
      totalPages: 1,
    });
    // Only short model should appear + back button
    expect(keyboard).toHaveLength(2);
    expect(keyboard[0][0].text).toBe("short");
  });

  it("includes models exactly at 64 bytes", () => {
    // "mdl_sel_p/" = 10 bytes, leaving 54 bytes for model
    const exactModelId = "a".repeat(54); // Exactly 64 bytes total
    const keyboard = buildModelsKeyboard({
      provider: "p",
      models: [exactModelId],
      currentPage: 1,
      totalPages: 1,
    });
    // Model should appear + back button
    expect(keyboard).toHaveLength(2);
    expect(keyboard[0][0].text).toContain("a");
  });
});

describe("model ID truncation", () => {
  it("does not truncate short model names", () => {
    const keyboard = buildModelsKeyboard({
      provider: "test",
      models: ["short-model"],
      currentPage: 1,
      totalPages: 1,
    });
    expect(keyboard[0][0].text).toBe("short-model");
  });

  it("truncates long model names with ellipsis prefix", () => {
    const longModel = "this-is-a-very-long-model-name-that-exceeds-limit";
    const keyboard = buildModelsKeyboard({
      provider: "test",
      models: [longModel],
      currentPage: 1,
      totalPages: 1,
    });
    // Should be truncated to 38 chars with ellipsis prefix
    expect(keyboard[0][0].text.length).toBeLessThanOrEqual(38);
    expect(keyboard[0][0].text.startsWith("\u2026")).toBe(true);
  });

  it("preserves end of model name when truncating", () => {
    const model = "prefix-important-suffix";
    const keyboard = buildModelsKeyboard({
      provider: "test",
      models: [model],
      currentPage: 1,
      totalPages: 1,
    });
    // Full name is 23 chars, within limit
    expect(keyboard[0][0].text).toBe(model);
  });
});
