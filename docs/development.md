# Development Guide

## Local Environment

### Required Tools

- Node.js 22+ (runtime baseline)
- pnpm (package management)
- Bun (optional, for TypeScript execution)

### Port Mappings

| Service | Port | URL |
|---------|------|-----|
| Gateway | 18789 | http://localhost:18789 |
| Control UI | 3000 | http://localhost:3000 |

## Setup

```bash
git clone https://github.com/moshehbenavraham/crocbot.git
cd crocbot

pnpm install
pnpm build
```

## Dev Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run CLI in dev mode |
| `pnpm crocbot <cmd>` | Run CLI commands via tsx |
| `pnpm gateway:watch` | Gateway with auto-reload |
| `pnpm gateway:dev` | Gateway in dev mode (skip channels) |
| `pnpm build` | TypeScript compilation |
| `pnpm lint` | Lint with oxlint |
| `pnpm format` | Format check with oxfmt |
| `pnpm test` | Run tests with Vitest |
| `pnpm test:coverage` | Tests with coverage report |
| `pnpm ui:dev` | Control UI dev server |
| `pnpm ui:build` | Build Control UI |

## Development Workflow

1. Pull latest from `main`
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes with clear commits
4. Run lint/build/test: `pnpm lint && pnpm build && pnpm test`
5. Open PR with description

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm vitest run src/telegram/network-errors.test.ts

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch

# Live tests (requires real API keys)
CROCBOT_LIVE_TEST=1 pnpm test:live
```

### Test Coverage

Coverage thresholds (enforced via Vitest):
- Lines: 70%
- Branches: 70%
- Functions: 70%
- Statements: 70%

## Code Style

- **Language**: TypeScript (ESM, strict mode)
- **Linting**: oxlint
- **Formatting**: oxfmt
- **Comments**: Add brief comments for tricky logic
- **File size**: Aim for under ~700 LOC

Run before commits:
```bash
pnpm lint
pnpm format
```

## Pre-commit Hooks

Install pre-commit hooks:
```bash
prek install
```

This runs the same checks as CI before each commit.

## Debugging

### Gateway Issues

```bash
# Check gateway status
crocbot gateway status

# Run with verbose logging
crocbot gateway --verbose

# Check health endpoint
curl http://localhost:18789/health
```

### Telegram Connection Issues

```bash
# Check channel status
crocbot channels status --probe

# View gateway logs
tail -f /tmp/crocbot-gateway.log
```

### Test Failures

```bash
# Run specific test file in watch mode
pnpm vitest src/path/to/file.test.ts

# Run with more verbose output
pnpm vitest run --reporter=verbose
```

## Project Structure

```
src/
  agents/           # Pi agent runtime
  auto-reply/       # Message dispatch
  cli/              # CLI commands
  config/           # Configuration
  gateway/          # Gateway server
  telegram/         # Telegram channel
  infra/            # Infrastructure utilities
  media/            # Media processing
  hooks/            # Hook system
  plugins/          # Plugin runtime

docs/               # Documentation (Mintlify)
scripts/            # Build and dev scripts
dist/               # Built output
```
