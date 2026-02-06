# test/

Shared test infrastructure and end-to-end tests.

## Structure

```
test/
  fixtures/               # Static test data and mock configs
    child-process-bridge/ # Child process test fixtures
  helpers/                # Shared test helper functions
  mocks/                  # Mock implementations for testing
```

## Test Strategy

- **Unit tests** — colocated with source files as `*.test.ts` in `src/`
- **E2E tests** — suffixed `*.e2e.test.ts`, run via `pnpm test:e2e`
- **Live tests** — require `CROCBOT_LIVE_TEST=1`, run via `pnpm test:live`
- **Docker tests** — full integration tests in containers, run via `pnpm test:docker:all`

## Running Tests

```bash
pnpm test              # Unit tests (parallel)
pnpm test:e2e          # End-to-end tests
pnpm test:live         # Live integration tests (needs running gateway)
pnpm test:docker:all   # Full Docker-based test suite
pnpm test:coverage     # Unit tests with coverage report
```

## Framework

Tests use [Vitest](https://vitest.dev/) with ESM-native configuration. See `vitest.config.ts` (unit), `vitest.e2e.config.ts` (e2e), and `vitest.live.config.ts` (live) at the project root.
