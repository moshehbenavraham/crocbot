# Implementation Summary

**Session ID**: `phase16-session05-acp-fixes-and-security-validation`
**Completed**: 2026-02-23
**Duration**: ~1 hour

---

## Overview

Final session of Phase 16 closing 5 ACP (Agent Control Policy) permission bypass vectors from upstream Section 1.7. Introduced a gateway HTTP tool deny list, refactored the ACP permission handler to evaluate tool safety instead of blindly auto-approving, tightened safe-kind inference, added non-read/search denial in headless mode, and added audit warnings when admin config re-enables dangerous tools. This session completed Phase 16 (52/52 applicable security items), establishing the green baseline for Arc 3.

---

## Deliverables

### Files Created
| File | Purpose | Lines |
|------|---------|-------|
| `src/acp/tool-safety.ts` | ACP tool safety classification (classifyToolSafety, inferToolKind, parseToolNameFromTitle) | ~107 |
| `src/acp/tool-safety.test.ts` | Unit tests for tool safety classification (17 tests) | ~168 |
| `src/acp/client.test.ts` | Unit tests for ACP permission handler (14 tests) | ~180 |
| `src/security/audit-gateway-deny.test.ts` | Audit warning tests for dangerous tool re-enable (5 tests) | ~111 |
| `test/security-integration.test.ts` | Cross-cutting security integration tests (17 tests) | ~174 |

### Files Modified
| File | Changes |
|------|---------|
| `src/agents/tool-policy.ts` | Added DEFAULT_GATEWAY_HTTP_TOOL_DENY constant, isDangerousHttpTool(), isReadSearchOnly() helpers |
| `src/agents/tool-policy.test.ts` | Added 12 tests for deny list and helper functions |
| `src/config/types.gateway.ts` | Added GatewayToolsConfig type, tools? field to GatewayConfig |
| `src/acp/client.ts` | Refactored requestPermission handler to evaluate tool safety before approval |
| `src/acp/index.ts` | Re-exported tool-safety module |
| `src/gateway/tools-invoke-http.ts` | Added gateway HTTP deny list filter (early-stage, before tool lookup) |
| `src/security/audit.ts` | Added gateway.tools_invoke_http.dangerous_allow audit check with risk-based severity |

---

## Technical Decisions

1. **Combined deny list scope**: Merged spec list (exec, process, write, edit, apply_patch, browser) with upstream additions (sessions_spawn, sessions_send, gateway) for 9-tool comprehensive deny list. Both lists identify genuinely dangerous tools for different reasons.
2. **Fail-closed for non-safe-kind tools**: In headless ACP mode, deny all non-read/search tools rather than auto-approving. This is the correct security posture for unattended operation.

---

## Test Results

| Metric | Value |
|--------|-------|
| Total Test Files | 787 |
| Tests | 6035 |
| Passed | 6035 |
| Failed | 0 |
| Skipped | 1 |
| New Tests Added | 65 |

---

## Lessons Learned

1. ACP SDK ToolKind type provides 10 kinds (read, edit, delete, move, search, execute, think, fetch, switch_mode, other) -- conservative boundary matching works well for safe-kind inference without requiring full tool metadata.
2. Gateway HTTP deny list must be enforced as early-stage filter (before profile expansion and policy pipeline) to prevent bypass through intermediate policy layers.

---

## Future Considerations

Items for future sessions:
1. Plugin fetch calls remain unguarded for SSRF -- tracked as [P06] active concern requiring runtime plugin analysis
2. ACP interactive prompting (non-headless mode) deferred -- current implementation denies non-safe operations in headless mode; interactive mode would allow user confirmation

---

## Session Statistics

- **Tasks**: 20 completed
- **Files Created**: 5
- **Files Modified**: 7
- **Tests Added**: 65
- **Blockers**: 0 resolved
