# Known Issues

## Skipped Workflows

None.

## GitHub Actions Billing Blocker -- RESOLVED

~~As of 2026-02-06, all GitHub Actions workflows fail with:~~
> ~~"The job was not started because recent account payments have failed or your spending limit needs to be increased."~~

**Resolved**: 2026-02-09. Billing issue on `moshehbenavraham` account has been fixed. All GitHub Actions workflows are now executing.

## CodeQL Code Scanning -- RESOLVED

~~The CodeQL Analysis job in `security.yml` fails with:~~
> ~~"Code scanning is not enabled for this repository."~~

**Resolved**: 2026-02-09. Code scanning is enabled in repo Settings. CodeQL Analysis job runs successfully on push to main and on schedule.

## npm Audit Vulnerabilities -- RESOLVED

~~`pnpm audit` reports 7 vulnerabilities (3 high, 4 moderate) in transitive dependencies.~~

**Resolved**: 2026-02-09 (Session 04). All vulnerabilities resolved via pnpm overrides and dependency updates:
- `node-tar` -- resolved via existing override `"tar": "7.5.7"`
- `fast-xml-parser` -- resolved via pnpm override `"fast-xml-parser": ">=5.3.4"` (5.2.5 -> 5.3.5)
- `@isaacs/brace-expansion` -- resolved via pnpm override `"@isaacs/brace-expansion": ">=5.0.1"` (5.0.0 -> 5.0.1)
- `hono` (4 CVEs) -- resolved via direct dependency update `4.11.4` -> `4.11.7`

Full triage: `.spec_system/audit/vulnerability-triage.md`

## E2E Test Failures -- RESOLVED

~~18 E2E tests across 16 files were failing + 2 skipped.~~

**Resolved**: 2026-02-09 (Sessions 02-03). All E2E tests now pass:
- **Session 02** (`phase07-session02`): Fixed 7 mechanical failures (config redaction, behavior changes, reference errors)
- **Session 03** (`phase07-session03`): Fixed 11 complex failures (auth drift, removed features)
- Current status: 240 passing, 3 skipped, 0 failures

Full audit: `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/audit.md`

## CI Lint/Format Failures -- RESOLVED

Pre-existing lint (10 errors) and format (36 files) failures in CI were fixed in Session 04:
- Lint: removed unused imports, fixed type assertions, added error cause chain, fixed template expression types
- Format: auto-formatted 36 markdown README files

## Docker Release Workflow -- RESOLVED

~~The Docker Release workflow (`docker-release.yml`) fails on both amd64 and arm64 builds due to a Dockerfile bug: the `gogcli` download URL hardcodes `linux_amd64` architecture, causing a 404 on arm64 builds.~~

**Resolved**: 2026-02-09 (Pipeline run). Two root causes fixed:
- `gogcli` version pinned to `v1.5.0` which does not exist (latest is `v0.9.0`) — updated to `v0.9.0`
- Architecture hardcoded to `linux_amd64` — replaced with `$(dpkg --print-architecture)` for multi-arch support

## Axios Vulnerability (GHSA-43fc-jf86-j433) -- RESOLVED

~~`pnpm audit` reports 1 high vulnerability: axios <=1.13.4 DoS via `__proto__` key in `mergeConfig`.~~
~~Path: `.>@slack/bolt>axios`~~

**Resolved**: 2026-02-10 (Pipeline run). Added pnpm override `"axios": ">=1.13.5"` to force patched version.

## CI Format Failure (src/mcp/README_mcp.md) -- RESOLVED

~~CI format check fails on `src/mcp/README_mcp.md` due to unformatted markdown tables.~~

**Resolved**: 2026-02-10 (Pipeline run). File formatted with `oxfmt`.

## Bun tsc Build -- KNOWN ISSUE (Informational)

The CI job `checks (bun, build, bunx tsc -p tsconfig.json)` fails with type errors from the upstream dependency `@mariozechner/pi-coding-agent` (e.g., `discoverModels`, `discoverAuthStorage` not found on imported type, `systemPrompt` not in `CreateAgentSessionOptions`).

**Impact**: Informational only. The Node build (`pnpm build` via tsdown) passes cleanly. This failure does not block any workflow.
**Root Cause**: Bun's TypeScript module resolution differs from Node's, exposing type definition mismatches in the third-party dependency.
**Resolution**: Will resolve when upstream dependency updates its type definitions.

## Windows Path Resolution in Phase 14 Tests -- RESOLVED

~~`checks-windows (node, test)` fails: 9 assertion errors across `paths.test.ts` and `memory-isolation.test.ts`. Tests expected `\fakehome\.crocbot\...` but received `D:\fakehome\.crocbot\...`.~~

**Resolved**: 2026-02-16 (Pipeline run). Test expectations used `path.join(FAKE_HOME, ...)` which omits the drive letter on Windows. The implementation calls `resolveEffectiveHomeDir` → `path.resolve(raw)`, which prepends the current drive. Fixed by using `path.resolve(FAKE_HOME)` in expected values.

## Windows Nix Integration Tests -- RESOLVED

~~2 tests in `config.nix-integration-u3-u5-u9.test.ts` fail on Windows: case-sensitive env var precedence tests (`crocbot_STATE_DIR` vs `CROCBOT_STATE_DIR`).~~

**Resolved**: 2026-02-09 (Pipeline run). Tests now skip on Windows via `it.skipIf(process.platform === "win32")`. Windows environment variables are case-insensitive by design, so case-based precedence testing is not possible on that platform.

## Current Test Counts (Phase 07 Baseline - 2026-02-09)

- Unit tests (`pnpm test`): 4224 passing, 1 skipped, 0 failures (701 test files)
- E2E tests (`pnpm test:e2e`): 240 passing, 3 skipped, 0 failures (52 test files)
- Security integration tests: 37 passing (23 SSRF + 14 path traversal/download)
- npm audit: 0 vulnerabilities
- Full baseline: `.spec_system/audit/green-baseline.md`
