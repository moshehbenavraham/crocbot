# src/terminal/

CLI UI helpers — ANSI formatting, progress indicators, tables, and prompts.

## Key Files

| File | Purpose |
|------|---------|
| `colors.ts` | ANSI color utilities |
| `progress.ts` | Progress bars and spinners |
| `tables.ts` | Terminal table rendering |
| `prompts.ts` | Interactive prompts |
| `theme.ts` | Terminal color theme |
| `stream.ts` | Stream writing utilities |

## Purpose

Provides the visual layer for CLI output. Used by `src/commands/` and `src/cli/` to render formatted status displays, dashboards, progress indicators, and interactive prompts.

## Related

- TUI (full terminal UI): `src/tui/`
- CLI commands: `src/commands/`
