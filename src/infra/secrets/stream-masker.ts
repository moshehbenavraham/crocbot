/**
 * Streaming chunk masker with tail-buffer boundary handling.
 *
 * Maintains a sliding tail buffer of `maxSecretLength` characters from the
 * previous chunk to detect secrets that span chunk boundaries.  On each
 * push() the buffer is prepended to the new chunk, masked, and then split:
 * everything except the last `maxSecretLength` chars is emitted, and the
 * remainder becomes the new tail buffer.  flush() emits the final buffer.
 */

import { SecretsRegistry } from "./registry.js";

export class StreamMasker {
  private readonly registry: SecretsRegistry;
  private tailBuffer = "";

  constructor(registry: SecretsRegistry) {
    this.registry = registry;
  }

  /**
   * Push a new chunk through the masker.
   * Returns the safe-to-emit portion (already masked).
   */
  push(chunk: string): string {
    if (this.registry.size === 0) {
      return chunk;
    }

    const bufferSize = this.registry.maxSecretLength;
    if (bufferSize === 0) {
      return this.registry.mask(chunk);
    }

    const combined = this.tailBuffer + chunk;
    const masked = this.registry.mask(combined);

    if (masked.length <= bufferSize) {
      // Entire masked output fits in the buffer -- hold it all back.
      this.tailBuffer = masked;
      return "";
    }

    const emitEnd = masked.length - bufferSize;
    this.tailBuffer = masked.slice(emitEnd);
    return masked.slice(0, emitEnd);
  }

  /**
   * Flush remaining tail buffer at stream end.
   * Returns the masked tail (may be empty).
   */
  flush(): string {
    if (this.registry.size === 0) {
      return "";
    }
    const remaining = this.tailBuffer;
    this.tailBuffer = "";
    // Mask again in case the tail itself contains a secret fragment that
    // was only partially visible before.
    return remaining ? this.registry.mask(remaining) : "";
  }

  /** Reset internal state for reuse. */
  reset(): void {
    this.tailBuffer = "";
  }
}
