# Upstream Extensions Catalog

## Provider Plugins (Authentication/API Access)

These extensions provide authentication flows or API proxies for LLM providers.

| Extension | Description |
|-----------|-------------|
| **copilot-proxy** | GitHub Copilot token proxy. Allows using Copilot credentials for API access to models. |
| **google-antigravity-auth** | Google Antigravity OAuth flow. Provides authenticated access to Google's experimental AI APIs. |
| **google-gemini-cli-auth** | Gemini CLI OAuth flow. Authenticates with Google for Gemini API access using browser-based OAuth. |

---

## Memory Plugins (Long-term Storage)

These extensions provide persistent memory and context storage.

| Extension | Description |
|-----------|-------------|
| **memory-lancedb** | LanceDB-backed vector memory. Stores embeddings locally using LanceDB for semantic search. Features auto-capture (saves important info from conversations) and auto-recall (injects relevant memories into context). Uses OpenAI embeddings. |

---

## Tool Plugins (Capabilities)

These extensions add specialized tools and capabilities.

| Extension | Description |
|-----------|-------------|
| **voice-call** | Full voice calling system. Supports Twilio, Telnyx, and Plivo as providers. Features inbound/outbound calls, TTS (OpenAI/ElevenLabs), STT (OpenAI Realtime), call recording, and webhook handling. Can expose via ngrok or Tailscale Funnel. |
| **lobster** | Lobster workflow integration. Typed JSON-first pipelines with approvals and resume. Can call back into crocbot tools via `clawd.invoke`. For complex multi-step automations. |
| **llm-task** | JSON-only LLM task runner. Structured task execution with JSON input/output for programmatic LLM interactions. |
| **open-prose** | OpenProse VM skill pack. Adds slash commands and telemetry for the OpenProse writing assistant. |

---

## Diagnostics Plugins

| Extension | Description |
|-----------|-------------|
| **diagnostics-otel** | OpenTelemetry exporter. Exports traces, metrics, and logs to OTEL-compatible backends (Jaeger, Zipkin, etc.) for observability. |

---

*Catalog generated from commit `af3ee9cee^` (pre-removal state)*
