# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 02 - Operational Maturity and Observability
**Completed Sessions**: 16

---

## Recommended Next Session

**Session ID**: `phase02-session04-error-reporting-alerting`
**Session Name**: Error Reporting and Alerting
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: 15-20

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 completed (structured logging) - Completed 2026-01-30
- [x] Session 02 completed (metrics) - Completed 2026-01-30
- [x] Telegram bot configured for self-notification (inherent from existing Telegram integration)

### Dependencies
- **Builds on**: Session 01 (structured logging) provides the logging infrastructure for error categorization; Session 02 (metrics) provides the foundation for alerting thresholds
- **Enables**: Session 05 (operational runbooks) which requires alerting to be in place for comprehensive documentation

### Project Progression
This session is the natural next step in the Phase 02 Operational Maturity progression:
1. ✅ Structured logging (Session 01) - Foundation for observability
2. ✅ Metrics monitoring (Session 02) - Quantitative observability
3. ✅ Technical debt cleanup (Session 03) - Codebase hygiene
4. ➡️ **Error reporting & alerting (Session 04)** - Proactive incident detection
5. ⏳ Operational runbooks (Session 05) - Human response procedures

Error alerting is a critical capability for production operations. With logging and metrics already in place, adding alerting completes the observability triad and enables proactive incident response.

---

## Session Overview

### Objective
Implement error aggregation and alerting infrastructure for proactive incident detection and response.

### Key Deliverables
1. Error categorization system (critical, warning, info severity levels)
2. Error aggregation with deduplication and rate limiting
3. Webhook interface for external alerting systems
4. Self-notification via Telegram for critical errors
5. Alerting configuration documentation

### Scope Summary
- **In Scope (MVP)**: Error severity classification, deduplication, webhook interface, Telegram self-notification, threshold configuration
- **Out of Scope**: Third-party integrations (Sentry, PagerDuty), complex rules engine, historical analytics

---

## Technical Considerations

### Technologies/Patterns
- Build on existing structured logging from `src/infra/logging.ts`
- Leverage Prometheus metrics from `src/infra/metrics.ts` for alerting thresholds
- Use grammy Telegram bot for self-notification
- Implement webhook interface for extensible alerting

### Potential Challenges
- Rate limiting to prevent alert storms during cascading failures
- Deduplication logic for repeated error patterns
- Balancing alert sensitivity (avoiding noise vs. missing issues)
- Testing alerting in non-production environments

### Relevant Considerations
- [P00] **Telegram-only channel registry**: Self-notification leverages the existing Telegram integration, no new channel work required
- [P00] **TypeScript as refactoring guide**: Strict typing will help ensure error types are properly categorized and handled

---

## Alternative Sessions

If this session is blocked:
1. **phase02-session05-operational-runbooks** - Can be started if alerting is deferred, though runbooks will be less complete without alerting documentation

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
