import { describe, expect, it } from "vitest";

/**
 * The ACP client's requestPermission handler is embedded in createAcpClient as a
 * closure. To test it in isolation we extract the same logic into a helper that
 * mirrors the handler's behavior and import the classification modules directly.
 */
import { classifyToolSafety, parseToolNameFromTitle } from "./tool-safety.js";

/** Minimal PermissionOption shape used in tests. */
type TestPermOption = {
  optionId: string;
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
  name: string;
};

/**
 * Replicate the requestPermission logic from client.ts so we can unit-test
 * the decision path without spawning a real ACP subprocess.
 */
function resolvePermission(params: {
  title: string | undefined;
  kind: string | undefined;
  options: TestPermOption[];
}): { outcome: { outcome: string; optionId: string } } {
  const toolName = parseToolNameFromTitle(params.title) ?? "";
  const safety = classifyToolSafety(toolName, params.kind);
  const options = params.options;
  const allowOnce = options.find((o) => o.kind === "allow_once");
  const rejectOnce = options.find((o) => o.kind === "reject_once");

  if (safety.isDangerous) {
    const denyId = rejectOnce?.optionId ?? options[0]?.optionId ?? "reject";
    return { outcome: { outcome: "selected", optionId: denyId } };
  }

  if (safety.autoApprove) {
    const allowId = allowOnce?.optionId ?? options[0]?.optionId ?? "allow";
    return { outcome: { outcome: "selected", optionId: allowId } };
  }

  const fallbackId = rejectOnce?.optionId ?? options[0]?.optionId ?? "reject";
  return { outcome: { outcome: "selected", optionId: fallbackId } };
}

const DEFAULT_OPTIONS: TestPermOption[] = [
  { optionId: "allow-1", kind: "allow_once", name: "Allow once" },
  { optionId: "reject-1", kind: "reject_once", name: "Reject once" },
];

describe("acp client requestPermission handler", () => {
  it("auto-approves read tools without prompting", () => {
    const result = resolvePermission({
      title: "read: src/index.ts",
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("allow-1");
  });

  it("auto-approves search tools without prompting", () => {
    const result = resolvePermission({
      title: "search: foo",
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("allow-1");
  });

  it("auto-approves tools with explicit read kind", () => {
    const result = resolvePermission({
      title: "memory_get: key",
      kind: "read",
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("allow-1");
  });

  it("denies dangerous tool names (exec)", () => {
    const result = resolvePermission({
      title: "exec: uname -a",
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("reject-1");
  });

  it("denies dangerous tool names (write)", () => {
    const result = resolvePermission({
      title: "write: /tmp/pwn",
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("reject-1");
  });

  it("denies dangerous tool names (browser)", () => {
    const result = resolvePermission({
      title: "browser: open",
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("reject-1");
  });

  it("denies sessions_spawn", () => {
    const result = resolvePermission({
      title: "sessions_spawn: agent",
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("reject-1");
  });

  it("denies tools even if explicit kind is read when on deny list", () => {
    const result = resolvePermission({
      title: "exec: harmless",
      kind: "read",
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("reject-1");
  });

  it("denies non-read/non-search tools (fetch)", () => {
    const result = resolvePermission({
      title: "web_fetch: https://example.com",
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("reject-1");
  });

  it("denies tools with no title (unknown)", () => {
    const result = resolvePermission({
      title: undefined,
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("reject-1");
  });

  it("falls back to first option when no reject_once available", () => {
    const options: TestPermOption[] = [
      { optionId: "only-allow", kind: "allow_once", name: "Allow" },
    ];
    const result = resolvePermission({
      title: "exec: danger",
      kind: undefined,
      options,
    });
    expect(result.outcome.optionId).toBe("only-allow");
  });

  it("handles empty options array", () => {
    const result = resolvePermission({
      title: "exec: danger",
      kind: undefined,
      options: [],
    });
    expect(result.outcome.optionId).toBe("reject");
  });

  it("handles alias tool names (bash -> exec)", () => {
    const result = resolvePermission({
      title: "bash: ls",
      kind: undefined,
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("reject-1");
  });

  it("allows safe crocbot tools (memory_search)", () => {
    const result = resolvePermission({
      title: "memory_search: query",
      kind: "search",
      options: DEFAULT_OPTIONS,
    });
    expect(result.outcome.optionId).toBe("allow-1");
  });
});
