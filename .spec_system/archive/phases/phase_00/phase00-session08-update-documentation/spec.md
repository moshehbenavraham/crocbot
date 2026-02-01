# Session Specification

**Session ID**: `phase00-session08-update-documentation`
**Phase**: 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This is the final session of Phase 00. Sessions 01-07 stripped crocbot to its minimal footprint: native apps (iOS, Android, macOS) were removed, all extensions were deleted, non-Telegram channels were eliminated, the build system was simplified, unused dependencies were pruned, dead code was refactored away, and mobile-specific infrastructure was removed.

The codebase now targets a single deployment model: CLI + Telegram gateway on VPS/Docker/Coolify. However, the documentation still references all the removed features - WhatsApp, Discord, Slack, Signal, iMessage, Microsoft Teams, Matrix, Zalo, BlueBubbles, native apps, extensions, and multi-platform deployment options. Users attempting to deploy the stripped-down version would encounter confusing, outdated documentation.

This session updates all documentation to accurately reflect the new reality: a lean, Telegram-only gateway for VPS deployment. This includes updating README.md, removing or updating channel documentation, removing platform-specific docs for native apps, and ensuring installation/configuration guides target the VPS/Docker workflow.

---

## 2. Objectives

1. Update README.md to accurately describe Telegram-only gateway functionality
2. Clean up channel documentation (keep only Telegram, remove or archive others)
3. Remove platform documentation for native apps (iOS, Android, macOS app)
4. Update installation and configuration docs for VPS/Docker deployment focus

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-remove-native-apps` - Native apps removed
- [x] `phase00-session02-remove-extensions` - Extensions removed
- [x] `phase00-session03-remove-channels` - Non-Telegram channels removed
- [x] `phase00-session04-simplify-build` - Build system simplified
- [x] `phase00-session05-remove-dependencies` - Unused dependencies removed
- [x] `phase00-session06-refactor-dead-code` - Dead code removed
- [x] `phase00-session07-remove-mobile-code` - Mobile infrastructure removed

### Required Tools/Knowledge
- Markdown editing
- Mintlify docs conventions (root-relative links, no .md extensions)

### Environment Requirements
- Access to docs/ directory
- Understanding of remaining features post-Phase 00

---

## 4. Scope

### In Scope (MVP)
- Update README.md for Telegram-only focus
- Update docs/channels/index.md for single-channel reality
- Keep docs/channels/telegram.md and docs/channels/grammy.md
- Remove non-Telegram channel docs (discord.md, slack.md, whatsapp.md, signal.md, imessage.md, etc.)
- Remove native app platform docs (docs/platforms/ios.md, docs/platforms/android.md, docs/platforms/macos.md, docs/platforms/mac/)
- Update docs/platforms/index.md
- Update docs/start/getting-started.md for Telegram-only setup
- Update docs/install/ pages for VPS/Docker focus
- Update docs/index.md (main docs landing page)
- Verify and fix broken internal links
- Update docs.json navigation structure

### Out of Scope (Deferred)
- Adding new documentation - *Reason: Focus on cleanup, not expansion*
- Creating deployment tutorials - *Reason: Future work after Phase 00*
- Marketing copy changes - *Reason: Out of technical scope*
- Removing VPS/cloud platform docs (fly.md, hetzner.md, etc.) - *Reason: These remain relevant for deployment*

---

## 5. Technical Approach

### Architecture
Pure documentation update session - no code changes. All modifications are to Markdown files in docs/ and the root README.md.

### Design Patterns
- **Mintlify conventions**: Root-relative links without .md extensions (e.g., `/channels/telegram`)
- **GitHub README links**: Full absolute URLs (e.g., `https://aiwithapex.mintlify.app/...`)

### Technology Stack
- Markdown documentation
- Mintlify docs hosting (aiwithapex.mintlify.app)
- docs.json for navigation structure

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | No new files needed | - |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|------------|
| `README.md` | Update for Telegram-only, remove multi-channel references | ~100 |
| `docs/index.md` | Update overview for stripped-down focus | ~50 |
| `docs/channels/index.md` | Update for Telegram-only | ~30 |
| `docs/platforms/index.md` | Remove native app references | ~20 |
| `docs/start/getting-started.md` | Update for Telegram-only setup | ~50 |
| `docs/start/wizard.md` | Update wizard docs for remaining options | ~30 |
| `docs/install/index.md` | Update for VPS/Docker focus | ~20 |
| `docs/install/docker.md` | Ensure accurate for Telegram-only | ~20 |
| `docs/docs.json` | Update navigation to remove deleted pages | ~50 |

### Files to Delete
| File | Reason |
|------|--------|
| `docs/channels/discord.md` | Channel removed |
| `docs/channels/slack.md` | Channel removed |
| `docs/channels/whatsapp.md` | Channel removed |
| `docs/channels/signal.md` | Channel removed |
| `docs/channels/imessage.md` | Channel removed |
| `docs/channels/bluebubbles.md` | Channel removed |
| `docs/channels/msteams.md` | Channel removed |
| `docs/channels/matrix.md` | Channel removed |
| `docs/channels/zalo.md` | Channel removed |
| `docs/channels/zalouser.md` | Channel removed |
| `docs/channels/googlechat.md` | Channel removed |
| `docs/channels/twitch.md` | Channel removed |
| `docs/channels/line.md` | Channel removed |
| `docs/channels/mattermost.md` | Channel removed |
| `docs/channels/nextcloud-talk.md` | Channel removed |
| `docs/channels/nostr.md` | Channel removed |
| `docs/channels/tlon.md` | Channel removed |
| `docs/platforms/ios.md` | Native app removed |
| `docs/platforms/android.md` | Native app removed |
| `docs/platforms/macos.md` | Native app removed |
| `docs/platforms/mac/` | macOS app directory removed |

---

## 7. Success Criteria

### Functional Requirements
- [ ] README.md accurately describes Telegram-only gateway
- [ ] No documentation references removed channels (WhatsApp, Discord, Slack, etc.)
- [ ] No documentation references native apps (iOS, Android, macOS)
- [ ] No documentation references extensions
- [ ] Installation docs work for VPS/Docker deployment
- [ ] docs.json navigation only links to existing pages

### Testing Requirements
- [ ] Manual review of all modified docs
- [ ] Verify no broken internal links
- [ ] Check docs.json matches actual file structure

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Markdown follows existing conventions
- [ ] Mintlify link format correct (root-relative, no .md)

---

## 8. Implementation Notes

### Key Considerations
- README uses absolute URLs for GitHub rendering; docs use root-relative paths
- docs.json controls Mintlify navigation - must be updated when pages are deleted
- Keep troubleshooting.md in channels/ if it has generic content
- Preserve location.md if it applies to Telegram (location sharing)

### Potential Challenges
- **Finding all references**: grep for channel names across all docs
- **Broken links**: Use systematic search to find all internal links to deleted pages
- **Navigation consistency**: docs.json must match actual file structure exactly

### Relevant Considerations
No active concerns in CONSIDERATIONS.md affect this session. This is a documentation-only session with no technical debt implications.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Not applicable (documentation only)

### Integration Tests
- Not applicable (documentation only)

### Manual Testing
- Review README.md renders correctly on GitHub
- Verify docs.json navigation structure is valid JSON
- Spot-check internal links in modified files
- Ensure Telegram setup instructions are complete and accurate

### Edge Cases
- References to removed features in unexpected places (concepts/, tools/, etc.)
- External links to removed channel documentation
- Screenshots or images referencing removed features

---

## 10. Dependencies

### External Libraries
- None (documentation only)

### Other Sessions
- **Depends on**: Sessions 01-07 (all code removal complete)
- **Depended by**: Phase 00 completion, future deployment documentation

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
