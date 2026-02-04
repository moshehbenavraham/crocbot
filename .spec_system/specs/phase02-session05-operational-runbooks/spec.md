# Session Specification

**Session ID**: `phase02-session05-operational-runbooks`
**Phase**: 02 - Operational Maturity and Observability
**Status**: Not Started
**Created**: 2026-02-04

---

## 1. Session Overview

This session creates comprehensive operational runbooks that enable efficient incident response and routine operations for crocbot. Building on the complete observability infrastructure established in Phase 02 Sessions 01-04 (structured logging, Prometheus metrics, error alerting), these runbooks provide actionable, copy-pasteable procedures for common scenarios.

The runbooks assume a Telegram-first, Docker/Coolify deployment model as defined in the project architecture. Each runbook focuses on a specific operational domain: startup/shutdown procedures, Telegram troubleshooting, Docker container management, log analysis, backup/restore, and health check interpretation.

Completing this session finalizes Phase 02 (Operational Maturity and Observability), enabling progression to Phase 03 (Upstream Features Port). The documentation will be integrated into the existing Mintlify docs structure under the Reference & Templates group.

---

## 2. Objectives

1. Create 5 operational runbooks covering the most critical operational scenarios
2. Integrate runbooks into Mintlify documentation navigation (docs.json)
3. Provide copy-pasteable commands for all procedures (Docker, journalctl, curl, crocbot CLI)
4. Document interpretation of the observability infrastructure from Sessions 01-04

---

## 3. Prerequisites

### Required Sessions
- [x] `phase02-session01-structured-logging` - JSON logging, correlation IDs, redaction
- [x] `phase02-session02-metrics-monitoring` - Prometheus endpoint, gateway metrics
- [x] `phase02-session03-remaining-technical-debt` - BlueBubbles removal, stub cleanup
- [x] `phase02-session04-error-reporting-alerting` - Severity classification, webhook/Telegram notifiers

### Required Tools/Knowledge
- Docker CLI and Docker Compose commands
- journalctl for systemd log access
- Prometheus metrics endpoint (`/metrics`)
- crocbot CLI commands
- Telegram bot API diagnostics

### Environment Requirements
- None (documentation only)

---

## 4. Scope

### In Scope (MVP)
- `docs/runbooks/startup-shutdown.md` - Gateway startup/shutdown procedures
- `docs/runbooks/telegram-troubleshooting.md` - Telegram reconnection troubleshooting
- `docs/runbooks/docker-operations.md` - Docker container management
- `docs/runbooks/log-analysis.md` - Log analysis and debugging guide
- `docs/runbooks/health-checks.md` - Health check interpretation guide
- Update `docs/docs.json` navigation to include new runbook pages

### Out of Scope (Deferred)
- `docs/runbooks/backup-restore.md` - *Reason: Backup procedures already documented in `platforms/deployment.md` and `scripts/fly-backup.sh`*
- Video tutorials - *Reason: Outside MVP scope*
- Automated runbook execution - *Reason: Requires additional tooling*
- Third-party integration guides - *Reason: Not part of core operational docs*
- Disaster recovery planning - *Reason: Separate initiative*

---

## 5. Technical Approach

### Architecture
Pure Markdown documentation following Mintlify conventions. Each runbook is a standalone document with copy-pasteable commands and clear decision trees for troubleshooting.

### Design Patterns
- **Symptom-first organization**: Lead with observable symptoms, then provide resolution steps
- **Copy-paste friendly**: All commands should work when directly copied
- **Decision trees**: For complex troubleshooting, provide clear if/then flows
- **Cross-references**: Link to existing docs (health, metrics, logging) rather than duplicate

### Technology Stack
- Markdown (Mintlify-flavored)
- Bash command examples
- JSON examples for health/metrics responses

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `docs/runbooks/startup-shutdown.md` | Gateway startup/shutdown procedures | ~120 |
| `docs/runbooks/telegram-troubleshooting.md` | Telegram connection troubleshooting | ~150 |
| `docs/runbooks/docker-operations.md` | Docker container management | ~130 |
| `docs/runbooks/log-analysis.md` | Log analysis and debugging guide | ~180 |
| `docs/runbooks/health-checks.md` | Health check interpretation guide | ~140 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `docs/docs.json` | Add 5 runbook pages to navigation | ~10 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Each runbook has clear symptom descriptions
- [ ] All commands are copy-pasteable and tested
- [ ] Cross-references to existing docs are valid
- [ ] Runbooks cover Docker and systemd deployment models

### Testing Requirements
- [ ] All command examples verified as syntactically correct
- [ ] All internal doc links validated
- [ ] Mintlify navigation renders correctly

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Root-relative links without .md/.mdx extensions
- [ ] No real hostnames, tokens, or credentials in examples

---

## 8. Implementation Notes

### Key Considerations
- Follow existing runbook style from `docs/runbooks/incident-response.md`
- Use generic placeholders (localhost, example tokens) per docs conventions
- Keep procedures focused on Telegram-only deployment model
- Reference structured logging format from Session 01
- Reference metrics endpoint from Session 02
- Reference alerting severity levels from Session 04

### Potential Challenges
- **Keeping runbooks current**: Mitigate by referencing existing docs where possible
- **Edge case coverage**: Focus on common scenarios, link to troubleshooting for edge cases
- **Docker vs systemd differences**: Provide parallel examples where procedures differ

### Relevant Considerations
- [P00] **Stub files for disabled features**: Runbooks focus on active features only (TTS, pairing stubbed/disabled)
- [P00] **Telegram-only channel registry**: Documentation assumes single-channel Telegram deployment
- [P01] **Internal docs cleanup complete**: Runbooks will be added to cleaned docs structure
- [P00] **Mintlify docs.json sync**: Update navigation when adding runbook pages

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- N/A (documentation only)

### Integration Tests
- N/A (documentation only)

### Manual Testing
- Verify all command examples execute without syntax errors
- Verify all internal links resolve correctly
- Verify docs.json navigation renders in Mintlify dev server

### Edge Cases
- Ensure commands work on both Docker and systemd deployments
- Verify curl commands work with and without jq installed

---

## 10. Dependencies

### External Libraries
- None (documentation only)

### Other Sessions
- **Depends on**: phase02-session01 through phase02-session04 (all complete)
- **Depended by**: None (final session in Phase 02)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
