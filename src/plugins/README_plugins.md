# src/plugins/

Plugin system — discovery, loading, configuration, and runtime management.

## Structure

```
plugins/
  runtime/        # Plugin execution runtime
```

## Key Files

| File | Purpose |
|------|---------|
| `discovery.ts` | Finds plugins in configured directories |
| `loader.ts` | Loads and initializes plugins |
| `config.ts` | Plugin configuration management |
| `hooks.ts` | Plugin hook registration and dispatch |
| `http-registry.ts` | Plugin HTTP endpoint registration |
| `manifest.ts` | Plugin manifest parsing and validation |

## Plugin Lifecycle

1. **Discovery** — scans plugin directories for manifests
2. **Loading** — validates and initializes each plugin
3. **Registration** — hooks, tools, and HTTP endpoints are registered
4. **Runtime** — plugins execute alongside the agent

## Related

- Plugin SDK: `src/plugin-sdk/`
- Extensions (bundled plugins): `/extensions/`
