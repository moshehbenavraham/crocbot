# src/wizard/

Interactive onboarding wizard — guides new users through initial setup.

## Key Files

| File | Purpose |
|------|---------|
| `onboarding.ts` | Main wizard flow |
| `onboarding.finalize.ts` | Finalization and config writing |
| `prompts.ts` | Interactive prompt definitions |
| `sessions.ts` | Session setup within the wizard |
| `gateway.ts` | Gateway configuration wizard step |

## Wizard Flow

1. **Gateway setup** — port, bind address, authentication
2. **Workspace configuration** — agent workspace path
3. **Telegram setup** — bot token, groups, DM policy
4. **Model selection** — LLM provider and model
5. **Skills configuration** — enable/disable bundled skills
6. **Daemon installation** — systemd/launchd service setup

## Usage

```bash
crocbot onboard                  # Full interactive wizard
crocbot onboard --install-daemon # Include daemon setup
```

## Related

- Onboarding docs: [Wizard guide](https://aiwithapex.mintlify.app/start/wizard)
- Non-interactive onboarding: `src/commands/onboard-non-interactive/`
