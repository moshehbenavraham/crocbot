# extensions/

Bundled extensions that add capabilities to the crocbot runtime. Each extension is a self-contained package with its own `package.json`.

## Available Extensions

| Extension | Description |
|-----------|-------------|
| `copilot-proxy/` | GitHub Copilot authentication proxy |
| `diagnostics-otel/` | OpenTelemetry diagnostics integration |
| `google-antigravity-auth/` | Google Antigravity OAuth flow |
| `google-gemini-cli-auth/` | Google Gemini CLI authentication |
| `llm-task/` | LLM task execution extension |
| `lobster/` | Lobster runtime extension |
| `open-prose/` | Prose writing skills and examples |
| `telegram/` | Telegram-specific extension utilities |
| `voice-call/` | Voice call support (Twilio provider) |

## Development

Extensions are compiled during the build step via `scripts/build/compile-pi-extensions.ts`. Each extension typically has:

- `package.json` — dependencies and metadata
- `src/` — TypeScript source
- `README.md` — extension-specific documentation (most extensions include one)
