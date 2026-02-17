import { DEFAULT_MAX_LINKS } from "./defaults.js";

// Remove markdown link syntax so only bare URLs are considered.
// Uses indexOf-based scanning to avoid polynomial backtracking on repeated '[' chars.
const BARE_LINK_RE = /https?:\/\/\S+/gi;

function stripMarkdownLinks(message: string): string {
  // Replace [text](url) patterns with spaces using linear-time string scanning.
  let result = "";
  let i = 0;
  while (i < message.length) {
    if (message[i] !== "[") {
      result += message[i];
      i++;
      continue;
    }
    // Found '[', look for closing ']'
    const closeB = message.indexOf("]", i + 1);
    if (closeB < 0) {
      // No ']' found — keep rest as-is
      result += message.slice(i);
      break;
    }
    // Check for '(' immediately after ']'
    if (closeB + 1 < message.length && message[closeB + 1] === "(") {
      const closeP = message.indexOf(")", closeB + 2);
      if (closeP >= 0) {
        const url = message.slice(closeB + 2, closeP);
        if (/^https?:\/\/\S+$/i.test(url)) {
          // Valid markdown link — replace with space
          result += " ";
          i = closeP + 1;
          continue;
        }
      }
    }
    // Not a valid markdown link — keep the '['
    result += message[i];
    i++;
  }
  return result;
}

function resolveMaxLinks(value?: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_MAX_LINKS;
}

function isAllowedUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.hostname === "127.0.0.1") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function extractLinksFromMessage(message: string, opts?: { maxLinks?: number }): string[] {
  const source = message?.trim();
  if (!source) {
    return [];
  }

  const maxLinks = resolveMaxLinks(opts?.maxLinks);
  const sanitized = stripMarkdownLinks(source);
  const seen = new Set<string>();
  const results: string[] = [];

  for (const match of sanitized.matchAll(BARE_LINK_RE)) {
    const raw = match[0]?.trim();
    if (!raw) {
      continue;
    }
    if (!isAllowedUrl(raw)) {
      continue;
    }
    if (seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    results.push(raw);
    if (results.length >= maxLinks) {
      break;
    }
  }

  return results;
}
