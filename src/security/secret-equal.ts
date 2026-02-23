import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Timing-safe string comparison for secrets.
 *
 * Both inputs are SHA-256 hashed before comparison so that strings of
 * different lengths still take constant time (no early-exit on length
 * mismatch). Returns false for non-string / nullish inputs.
 */
export function secretEqual(
  provided: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }
  const hash = (s: string): Buffer => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}
