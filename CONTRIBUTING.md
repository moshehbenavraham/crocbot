# Contributing

## Branch Conventions

- `main` - Production-ready code (primary branch)
- `feature/*` - New features
- `fix/*` - Bug fixes

## Commit Style

Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

Use the committer script for scoped staging:
```bash
scripts/committer "feat: add new feature" path/to/files...
```

## Pull Request Process

1. Create feature branch from `main`
2. Make changes with clear commits
3. Run audit commands: `pnpm build && pnpm lint && pnpm test`
4. Update documentation if needed
5. Open PR with description
6. Address review feedback
7. Squash and merge

## Development Setup

See [docs/development.md](docs/development.md) for local environment setup.

## Code Style

- TypeScript ESM with `.js` extensions in imports
- Avoid `any` types
- Follow conventions in `.spec_system/CONVENTIONS.md`

## Testing

```bash
# Run all tests
pnpm test

# Run specific tests
pnpm test path/to/test.ts
```

## Documentation

- Internal links in `docs/**/*.md`: root-relative, no `.md`/`.mdx` extension
- Keep docs generic/safe for public (no real hostnames/tokens)
- Update `docs/docs.json` when adding/removing pages

## Code Review Norms

- Review within 24 hours when possible
- Be constructive and specific
- Approve when ready, request changes when not
