/**
 * Base64 payload size validation.
 *
 * Estimates the decoded byte size from a base64 string *before* calling
 * `Buffer.from()`, preventing denial-of-service via huge payloads that
 * would allocate unbounded memory during decode.
 */

/** Default maximum decoded size: 50 MiB. */
export const DEFAULT_MAX_BASE64_BYTES = 50 * 1024 * 1024;

/**
 * Estimate the decoded byte size of a base64 string without decoding it.
 * Returns 0 for empty / whitespace-only input.
 */
export function estimateBase64DecodedSize(base64: string): number {
  const len = base64.length;
  if (len === 0) {
    return 0;
  }
  let padding = 0;
  if (base64.charCodeAt(len - 1) === 0x3d) {
    padding += 1;
    if (len > 1 && base64.charCodeAt(len - 2) === 0x3d) {
      padding += 1;
    }
  }
  return Math.floor((len * 3) / 4) - padding;
}

export type ValidateBase64SizeResult =
  | { ok: true }
  | { ok: false; estimatedBytes: number; maxBytes: number };

/**
 * Check whether a base64 string would exceed `maxBytes` after decoding.
 * Call this *before* `Buffer.from(data, "base64")`.
 */
export function validateBase64Size(
  base64: string,
  maxBytes: number = DEFAULT_MAX_BASE64_BYTES,
): ValidateBase64SizeResult {
  const estimatedBytes = estimateBase64DecodedSize(base64);
  if (estimatedBytes > maxBytes) {
    return { ok: false, estimatedBytes, maxBytes };
  }
  return { ok: true };
}
