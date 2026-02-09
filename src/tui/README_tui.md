# src/tui/

Terminal User Interface — interactive full-screen terminal application.

## Structure

```
tui/
  components/     # TUI component library
  theme/          # TUI theming
```

## Key Files

| File               | Purpose                              |
| ------------------ | ------------------------------------ |
| `app.ts`           | Main TUI application entry           |
| `commands.ts`      | TUI command handling                 |
| `events.ts`        | Event system for TUI interactions    |
| `input-history.ts` | Input history (up/down arrow recall) |
| `shell.ts`         | Shell integration                    |
| `overlays.ts`      | Modal overlays and popups            |
| `status.ts`        | Status bar display                   |
| `formatters.ts`    | Output formatting for TUI            |

## Usage

```bash
pnpm tui           # Launch the TUI
pnpm tui:dev       # Launch in dev profile
```

## Related

- Terminal utilities: `src/terminal/`
- Pi TUI dependency: `@mariozechner/pi-tui`
