import { SecretsRegistry } from "./secrets/registry.js";

export function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") {
    return code;
  }
  if (typeof code === "number") {
    return String(code);
  }
  return undefined;
}

export function formatErrorMessage(err: unknown): string {
  let result: string;
  if (err instanceof Error) {
    result = err.message || err.name || "Error";
  } else if (typeof err === "string") {
    result = err;
  } else if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    result = String(err);
  } else {
    try {
      result = JSON.stringify(err);
    } catch {
      result = Object.prototype.toString.call(err);
    }
  }
  const registry = SecretsRegistry.getInstance();
  return registry.size > 0 ? registry.mask(result) : result;
}

export function formatUncaughtError(err: unknown): string {
  if (extractErrorCode(err) === "INVALID_CONFIG") {
    return formatErrorMessage(err);
  }
  let result: string;
  if (err instanceof Error) {
    result = err.stack ?? err.message ?? err.name;
  } else {
    return formatErrorMessage(err);
  }
  const registry = SecretsRegistry.getInstance();
  return registry.size > 0 ? registry.mask(result) : result;
}
