# src/plugin-sdk/

Public SDK for developing crocbot plugins. This is the external-facing API that plugin authors use.

## Exports

The SDK is published as `crocbot/plugin-sdk` and provides:

- Type definitions for plugin manifests
- Hook registration interfaces
- Tool definition helpers
- Plugin lifecycle types

## Usage

```typescript
import { definePlugin } from "crocbot/plugin-sdk";
```

## Related

- Plugin runtime: `src/plugins/`
- Plugin docs: [Plugins](https://aiwithapex.mintlify.app/plugins)
