# src/node-host/

Node.js subprocess bridge — spawns isolated Node.js child processes for specific tasks.

## Key Files

| File | Purpose |
|------|---------|
| `config.ts` | Subprocess configuration |
| `runner.ts` | Subprocess spawning and lifecycle |

## Purpose

Provides isolation by running certain operations in separate Node.js processes rather than in the main gateway event loop.
