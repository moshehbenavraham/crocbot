// Node helpers removed - stubs for compatibility

import type { GatewayRequestContext } from "./types.js";
import type { RespondFn } from "./types.js";

export function pickBrowserNode(_ctx: GatewayRequestContext, _nodeHint?: string | null): null {
  return null;
}

export function requireBrowserNode(_ctx: GatewayRequestContext, _nodeHint?: string | null): never {
  throw new Error("Browser node functionality requires a connected node");
}

export function safeParseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function respondUnavailableOnThrow<T>(
  respond: RespondFn,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    respond(false, undefined, {
      code: "-32603",
      message: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
