# Session Specification

**Session ID**: `phase01-session05-internal-docs-cleanup`
**Phase**: 01 - Production Hardening and Deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This is the final session of Phase 01, completing the production hardening journey. With technical debt cleaned (Session 01), Docker optimized (Session 02), gateway hardened (Session 03), and CI/CD finalized (Session 04), the remaining task is ensuring all internal documentation accurately reflects the Telegram-only architecture established in Phase 00.

Phase 00 Session 08 updated user-facing documentation, but internal/advanced documentation files were deferred. Per CONSIDERATIONS.md, 123 internal docs files still contain references to removed channels (Discord, Slack, Signal, iMessage, WhatsApp, Line) and platforms (iOS, macOS, Android). A comprehensive grep confirms 129 files currently contain these stale references.

Completing this cleanup ensures maintainers working on the codebase encounter consistent, accurate documentation that matches the actual implementation. This prevents confusion, reduces onboarding friction, and marks the codebase as fully production-ready.

---

## 2. Objectives

1. Remove or update all stale channel references (Discord, Slack, Signal, iMessage, WhatsApp, Line) from internal documentation
2. Remove or update all stale platform references (iOS, macOS, Android) from internal documentation
3. Verify docs/docs.json navigation entries are accurate and contain no dead links
4. Ensure Mintlify documentation builds without broken links or errors

---

## 3. Prerequisites

### Required Sessions
- [x] `phase01-session04-cicd-finalization` - CI/CD pipeline stable, no pending workflow changes

### Required Tools/Knowledge
- Familiarity with Mintlify documentation system
- Understanding of docs/docs.json navigation structure
- Knowledge of which channels/platforms were removed in Phase 00

### Environment Requirements
- Node.js 22+ available for running Mintlify locally (optional but recommended)
- Git for committing changes incrementally

---

## 4. Scope

### In Scope (MVP)
- Audit and update CLI documentation (`docs/cli/`) for stale references
- Audit and update concepts documentation (`docs/concepts/`) for stale references
- Audit and update gateway documentation (`docs/gateway/`) for stale references
- Audit and update install documentation (`docs/install/`) for stale references
- Audit and update platform documentation (`docs/platforms/`) for stale references
- Audit and update tools documentation (`docs/tools/`) for stale references
- Audit and update reference documentation (`docs/reference/`) for stale references
- Audit and update remaining root-level docs for stale references
- Verify and clean docs/docs.json navigation
- Run Mintlify build validation
- Update CONSIDERATIONS.md to mark this concern resolved

### Out of Scope (Deferred)
- Adding new documentation pages - *Reason: Scope creep, not needed for cleanup*
- Major documentation restructuring - *Reason: Only cleaning stale refs, not reorganizing*
- External API documentation - *Reason: Not affected by channel removal*
- User guides - *Reason: Already updated in Phase 00 Session 08*
- Code changes - *Reason: Documentation-only session*

---

## 5. Technical Approach

### Architecture
This session is documentation-focused with no code changes. The approach follows a systematic directory-by-directory audit pattern:

1. **Grep-driven discovery**: Use grep to identify files with stale references
2. **Categorized cleanup**: Process files by directory to maintain context
3. **Contextual updates**: Preserve historical context where appropriate (e.g., "previously supported X") while removing operational references
4. **Navigation sync**: Ensure docs.json reflects current file structure
5. **Build validation**: Run Mintlify build to catch broken links

### Design Patterns
- **Incremental verification**: Build/lint after each major batch of changes
- **Bottom-up processing**: Start with leaf directories, work up to navigation
- **Conservative editing**: Update rather than delete where context adds value

### Technology Stack
- Mintlify documentation framework
- Markdown files (260 total, 129 with stale references)
- docs.json navigation configuration

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | Documentation cleanup only | N/A |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `docs/cli/*.md` (~12 files) | Remove stale channel/platform references | ~100 |
| `docs/concepts/*.md` (~15 files) | Remove stale channel/platform references | ~150 |
| `docs/gateway/*.md` (~15 files) | Remove stale channel/platform references | ~100 |
| `docs/install/*.md` (~10 files) | Remove stale channel/platform references | ~80 |
| `docs/platforms/*.md` (~7 files) | Remove stale channel/platform references | ~50 |
| `docs/tools/*.md` (~10 files) | Remove stale channel/platform references | ~80 |
| `docs/reference/*.md` (~6 files) | Remove stale channel/platform references | ~60 |
| `docs/*.md` (root level, ~15 files) | Remove stale channel/platform references | ~100 |
| `docs/docs.json` | Verify/update navigation entries | ~20 |
| `.spec_system/CONSIDERATIONS.md` | Mark docs cleanup complete | ~5 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] No operational Discord references in docs (historical context permitted)
- [ ] No operational Slack references in docs (historical context permitted)
- [ ] No operational Signal references in docs (historical context permitted)
- [ ] No operational iMessage references in docs (historical context permitted)
- [ ] No operational WhatsApp references in docs (historical context permitted)
- [ ] No operational Line references in docs (historical context permitted)
- [ ] No operational iOS/macOS/Android platform references
- [ ] docs/docs.json navigation entries verified accurate
- [ ] Documentation reflects Telegram-only architecture

### Testing Requirements
- [ ] Mintlify build passes without errors
- [ ] No broken internal links reported
- [ ] Manual spot-check of updated pages

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Markdown follows existing conventions
- [ ] Git commit per logical batch of changes

---

## 8. Implementation Notes

### Key Considerations
- Preserve historical context where it adds value (e.g., migration notes)
- Some references may be in code blocks/examples - update these carefully
- Watch for cross-references between docs that may break
- docs.json is the single source of truth for navigation

### Potential Challenges
- **Hidden references in code blocks**: May require manual review after grep
- **Deeply nested navigation**: docs.json structure must be traversed carefully
- **Cross-file links**: Updating one file may require updating links in others
- **Historical context**: Deciding what to preserve vs. remove requires judgment

### Relevant Considerations
- [P00] **Internal docs reference removed features**: This session directly addresses the 123 internal docs files identified as having stale references. We will systematically audit and update each affected file.
- [P00] **Mintlify docs.json sync**: When removing or significantly changing pages, we must update docs/docs.json navigation entries to prevent broken links and navigation errors.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- N/A (documentation-only session)

### Integration Tests
- N/A (documentation-only session)

### Manual Testing
- Run `npx mintlify dev` locally to preview changes (if available)
- Navigate through docs.json sections to verify structure
- Click through updated pages to verify internal links work

### Edge Cases
- References in code blocks (preserve if showing historical examples)
- References in file paths (update to reflect current structure)
- References in table of contents / navigation (must update docs.json)
- Changelog entries (preserve as historical record)

---

## 10. Dependencies

### External Libraries
- Mintlify: documentation framework (no version change needed)

### Other Sessions
- **Depends on**: `phase01-session04-cicd-finalization` (CI/CD stable)
- **Depended by**: None (final session of Phase 01)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
