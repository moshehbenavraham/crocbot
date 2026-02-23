import { isDangerousHttpTool, isReadSearchOnly, normalizeToolName } from "../agents/tool-policy.js";

/** Safety classification returned by {@link classifyToolSafety}. */
export type ToolSafetyClassification = {
  /** Normalized tool name (empty string when name could not be resolved). */
  toolName: string;
  /** Resolved tool kind (undefined when unknown). */
  toolKind: string | undefined;
  /** True when the tool is on the gateway HTTP deny list. */
  isDangerous: boolean;
  /** True when the tool kind is read or search. */
  isSafeKind: boolean;
  /** True when auto-approval is acceptable (safe kind AND not dangerous). */
  autoApprove: boolean;
};

/**
 * Infer a tool kind from its name when no explicit kind is provided.
 * Uses conservative boundary matching to avoid substring false positives
 * (e.g. "readme" should not match "read").
 */
export function inferToolKind(name: string): string | undefined {
  if (!name) {
    return undefined;
  }
  const normalized = name.toLowerCase();

  const hasToken = (token: string): boolean => {
    const re = new RegExp(`(?:^|[._-])${token}(?:$|[._-])`);
    return re.test(normalized);
  };

  if (normalized === "read" || hasToken("read")) {
    return "read";
  }
  if (normalized === "search" || hasToken("search") || hasToken("find")) {
    return "search";
  }
  if (normalized.includes("fetch") || normalized.includes("http")) {
    return "fetch";
  }
  if (normalized.includes("write") || normalized.includes("edit") || normalized.includes("patch")) {
    return "edit";
  }
  if (normalized.includes("delete") || normalized.includes("remove")) {
    return "delete";
  }
  if (normalized.includes("move") || normalized.includes("rename")) {
    return "move";
  }
  if (
    normalized.includes("exec") ||
    normalized.includes("run") ||
    normalized.includes("bash") ||
    normalized.includes("process") ||
    normalized.includes("spawn")
  ) {
    return "execute";
  }
  return "other";
}

/**
 * Extract a tool name from a permission request title string.
 * Titles typically follow the pattern "toolName: description".
 */
export function parseToolNameFromTitle(title: string | undefined | null): string | undefined {
  if (!title) {
    return undefined;
  }
  const colonIdx = title.indexOf(":");
  if (colonIdx > 0) {
    const candidate = title.slice(0, colonIdx).trim();
    if (candidate && !candidate.includes(" ")) {
      return candidate;
    }
  }
  const firstWord = title.trim().split(/\s+/)[0];
  return firstWord || undefined;
}

/**
 * Classify a tool for safety based on its name and kind.
 *
 * @param toolName - Raw or normalized tool name (may be undefined).
 * @param explicitKind - Explicit tool kind from ACP metadata (may be undefined).
 * @returns Safety classification with auto-approval recommendation.
 */
export function classifyToolSafety(
  toolName: string | undefined | null,
  explicitKind: string | undefined | null,
): ToolSafetyClassification {
  const name = toolName ? normalizeToolName(toolName) : "";

  // Resolve kind: prefer explicit, fall back to inference from name.
  const resolvedKind = explicitKind?.trim().toLowerCase() || inferToolKind(name) || undefined;

  const isDangerous = name ? isDangerousHttpTool(name) : true;
  const isSafeKind = isReadSearchOnly(resolvedKind);
  const autoApprove = Boolean(name) && isSafeKind && !isDangerous;

  return { toolName: name, toolKind: resolvedKind, isDangerous, isSafeKind, autoApprove };
}
