# 4. Secrets Masking Pipeline

**Status:** Accepted
**Date:** 2026-02-10

## Context

Agents use API keys, tokens, and passwords during tool execution. Without masking, these credentials appear in logs, LLM context (sent to providers), streaming output, tool results, Telegram messages, and error reports. This creates a credential leakage risk across every output boundary.

## Decision

Implement a value-based secrets masking pipeline with seven output boundaries:

1. **SecretsRegistry**: Singleton that auto-discovers secrets from environment variables and config at startup. Registers exact values plus common encodings (base64, URL-encoded). Uses Aho-Corasick algorithm for efficient multi-pattern matching (10+ patterns), sequential scan for fewer.

2. **Masking boundaries**:
   - Logging: tslog masking transport applied to all loggers
   - Config: Deep masking in config snapshot exports
   - LLM context: Wrapper applied before sending to providers
   - Streaming output: Cross-chunk boundary detection via StreamMasker
   - Tool results: Masked after execution, before persistence
   - Telegram output: Messages, drafts, edits, and media captions masked before send
   - Error formatting: In-place masking in formatErrorMessage and formatUncaughtError

3. **Placeholder format**: `{{SECRET:hash8}}` where hash8 is the first 8 chars of SHA-256. Reversible via `unmask()` at tool execution time only.

4. **Composition**: Value-based masking (SecretsRegistry) runs first, pattern-based redaction (legacy regex) provides defense-in-depth. The placeholder format may be further transformed by pattern-based rules -- this is acceptable.

## Consequences

### Enables
- Agents can use credentials in shell commands without leaking them
- Safe to send full tool output to LLM providers
- Log files are safe to share/archive without credential scrubbing
- Config exports are safe to transmit

### Prevents
- Secrets appearing in any output boundary
- Encrypted at-rest storage (out of scope -- env injection only)

### Trade-offs
- Performance overhead: <1ms/log line, <5ms/streaming batch, <2ms/tool result
- Aho-Corasick automaton rebuilt on each register/unregister (acceptable for startup-only registration)
- Base64/URL-encoded variants increase pattern count 3x per secret
- Placeholder format interacts with pattern-based regex (defense-in-depth, not a bug)
