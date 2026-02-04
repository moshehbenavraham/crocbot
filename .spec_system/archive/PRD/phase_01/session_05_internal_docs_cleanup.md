# Session 05: Internal Docs Cleanup

**Session ID**: `phase01-session05-internal-docs-cleanup`
**Status**: Not Started
**Estimated Tasks**: ~12-18
**Estimated Duration**: 2-4 hours

---

## Objective

Clean up internal documentation files that still reference removed channels, platforms, and features from Phase 00. Ensure all documentation accurately reflects the Telegram-only state.

---

## Scope

### In Scope (MVP)
- Audit internal docs for stale channel references (Discord, Slack, Signal, iMessage, WhatsApp, Line)
- Audit internal docs for stale platform references (iOS, macOS, Android)
- Update or remove CLI documentation with stale references
- Update or remove advanced concept docs with stale references
- Update gateway configuration docs if needed
- Update tool documentation if needed
- Update reference documentation if needed
- Verify docs/docs.json navigation is accurate
- Run Mintlify build to verify no broken links
- Update CONSIDERATIONS.md to mark docs cleanup complete

### Out of Scope
- Adding new documentation features
- Major documentation restructuring
- External API documentation
- User guides (already updated in Phase 00 Session 08)

---

## Prerequisites

- [ ] Session 04 complete (CI/CD finalized)
- [ ] List of files with stale references (from docs-audit.md)
- [ ] Mintlify local preview available (optional)

---

## Deliverables

1. All internal docs updated for Telegram-only focus
2. No stale channel or platform references
3. docs/docs.json navigation verified
4. Mintlify build passes (no broken links)
5. CONSIDERATIONS.md updated

---

## Success Criteria

- [ ] No Discord references in docs (except historical context)
- [ ] No Slack references in docs (except historical context)
- [ ] No Signal references in docs (except historical context)
- [ ] No iMessage references in docs (except historical context)
- [ ] No WhatsApp references in docs (except historical context)
- [ ] No Line references in docs (except historical context)
- [ ] No iOS/macOS/Android platform references
- [ ] docs/docs.json accurate
- [ ] No broken internal links
- [ ] Documentation reflects Telegram-only state
