import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { ReasoningLevel, ThinkLevel } from "../../auto-reply/thinking.js";
import type { crocbotConfig } from "../../config/config.js";
import type { ExecToolDefaults } from "../bash-tools.js";

export function mapThinkingLevel(level?: ThinkLevel): ThinkingLevel {
  // pi-agent-core supports "xhigh"; crocbot enables it for specific models.
  if (!level) {
    return "off";
  }
  return level;
}

export function resolveExecToolDefaults(config?: crocbotConfig): ExecToolDefaults | undefined {
  const tools = config?.tools;
  if (!tools?.exec) {
    return undefined;
  }
  return tools.exec;
}

export function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    const serialized = JSON.stringify(error);
    return serialized ?? "Unknown error";
  } catch {
    return "Unknown error";
  }
}

/**
 * Returns the path string or a safe default when the path is undefined/null.
 * Prevents crashes when context file entries have missing paths.
 */
export function safeContextFilePath(path: string | undefined | null): string {
  return path ?? "(unknown)";
}

export type { ReasoningLevel, ThinkLevel };
