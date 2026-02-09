# src/providers/

External authentication providers for LLM services and third-party integrations.

## Key Files

| File         | Purpose                            |
| ------------ | ---------------------------------- |
| `copilot.ts` | GitHub Copilot token exchange      |
| `qwen.ts`    | Qwen (Alibaba Cloud) auth          |
| `google.ts`  | Google OAuth for Gemini/Cloud APIs |

## Purpose

Handles OAuth flows, token refresh, and credential management for external providers. These are used by the agent runtime when routing to different LLM backends.

## Related

- Agent auth profiles: `src/agents/auth-profiles/`
- Model configuration: `src/config/`
- Model failover docs: [Model failover](https://aiwithapex.mintlify.app/concepts/model-failover)
