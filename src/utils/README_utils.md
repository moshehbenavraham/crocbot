# src/utils/

Common utility functions shared across the codebase.

## Key Files

| File                  | Purpose                                |
| --------------------- | -------------------------------------- |
| `account-ids.ts`      | Account ID generation and parsing      |
| `booleans.ts`         | Boolean parsing utilities              |
| `delivery-context.ts` | Message delivery context helpers       |
| `message-channels.ts` | Channel identification helpers         |
| `time.ts`             | Time formatting and duration utilities |
| `usage.ts`            | Token/cost usage formatting            |

## Guidelines

- Keep utilities small, focused, and well-tested
- Avoid creating catch-all "utils" — if a utility is specific to a module, keep it there
- All utilities should be pure functions where possible
