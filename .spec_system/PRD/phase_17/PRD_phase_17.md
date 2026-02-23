# Phase 17: Core Runtime Stability

**Status**: In Progress
**Sessions**: 5
**Completed**: 4/5 (80%)

---

## Objectives

1. Fix gateway session management bugs (ghost sessions, reply loss, config merge errors)
2. Fix agent runtime bugs (deadlocks during compaction, token count drift, dropped tool results)
3. Fix session/process management bugs (lock races, transcript path confusion, hanging CLI)
4. Harden reliability with bounded memory growth and crash recovery

---

## Progress Tracker

| Session | Name | Status | Validated |
|---------|------|--------|-----------|
| 01 | Research and Triage | Complete | 2026-02-23 |
| 02 | Gateway Session and Routing Fixes | Complete | 2026-02-23 |
| 03 | Agent Compaction, Deadlock, and Token Fixes | Complete | 2026-02-23 |
| 04 | Session Management and Process Fixes | Complete | 2026-02-23 |
| 05 | Memory Bounding and Validation | Pending | - |

---

## Scope Summary

**Total upstream items**: 62 (Sections 3, 4, 8, 16)
**Actionable items**: 54 (31 Apply + 23 Adapt)
**Skip**: 3 (4.8%)
**Duplicate**: 5 (cross-section or cross-phase)
**New files required**: 4 (resolve-route.ts, with-timeout.ts, restart-recovery.ts, delivery-queue.ts)

### Session Assignments

| Session | Focus | Items | Est. Hours |
|---------|-------|-------|------------|
| 02 | Gateway Session and Routing Fixes | 16 | 6-8 |
| 03 | Agent Compaction, Deadlock, and Token Fixes | 15 | 7-9 |
| 04 | Session Management and Process Fixes | 14 | 6-8 |
| 05 | Memory Bounding and Validation | 12 | 5-7 |

---

## Key Findings from Triage (Session 01)

1. **Skip rate 4.8%** -- dramatically lower than expected 40-60% because most items target shared infrastructure crocbot retains
2. **23 Adapt items** (37%) -- high count reflects crocbot's file restructuring rather than missing functionality
3. **8 dependency chains** identified requiring co-porting for correctness
4. **pi-embedded-subscribe** directory absent in crocbot; handlers likely merged into pi-embedded-runner
5. **4 new files** must be created (upstream extracted new modules not yet in crocbot)
