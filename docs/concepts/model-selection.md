---
title: "Interactive Model Selection"
summary: "Browse and select AI models with inline buttons in Telegram"
read_when:
  - User asks about changing models in Telegram
  - User asks about /model or /models commands
  - User wants to browse available AI providers
---

# Interactive Model Selection

Browse AI providers and select models through an interactive inline keyboard in Telegram. This feature eliminates the need to memorize and type model IDs manually.

## Overview

When you send `/model` or `/models` in Telegram, crocbot displays interactive buttons that let you:

- View your current model at a glance
- Browse available AI providers
- Navigate paginated model lists
- Select a model with a single tap

This works in all Telegram contexts: direct messages, group chats, and forum topics.

## Commands

### `/model` - View Current Model

Shows your currently active model with a "Browse providers" button to change it.

```
Current model: anthropic/claude-sonnet-4-5

[Browse providers]
```

### `/models` - Browse Providers Directly

Shows the provider list immediately, skipping the current model display.

```
Select a provider:

[Anthropic] [OpenAI]
[OpenRouter] [Moonshot]
```

## Button Flow

### 1. Provider Selection

After tapping "Browse providers" or using `/models`, you see provider buttons arranged two per row:

```
Select a provider:

[Anthropic] [OpenAI]
[OpenRouter] [Moonshot]
[GLM] [MiniMax]
```

### 2. Model List

Tapping a provider shows its available models. Lists with more than 8 models are paginated:

```
Anthropic models:

[claude-sonnet-4-5] *
[claude-opus-4-5]
[claude-haiku-3-5]
...

[< Prev] [Back] [Next >]
```

The asterisk (*) or checkmark indicates your currently selected model.

### 3. Model Selection

Tap a model to select it. You receive a confirmation message:

```
Model changed to anthropic/claude-opus-4-5
```

The model change takes effect immediately for your current session.

## Navigation

| Button | Action |
|--------|--------|
| Provider name | View models for that provider |
| Model name | Select that model |
| `< Prev` | Previous page of models |
| `Next >` | Next page of models |
| `Back` | Return to provider list |

## Context Isolation

Model selections are isolated per chat context:

- **DM**: Your personal default model
- **Group chat**: Model for that specific group
- **Forum topic**: Model for that specific topic thread

Changing the model in one context does not affect other contexts.

## Troubleshooting

### Buttons Not Responding

If buttons stop responding after a bot restart, send a new `/model` or `/models` command. Old message buttons may reference expired callback data.

### Model Not in List

If a model you expect is not listed:

1. Check that the provider is configured with valid credentials
2. Verify the model is in your allowlist (`agents.defaults.models`)
3. Run `crocbot models status` to check provider auth

### "Model is not allowed" Error

Your configuration includes an allowlist that restricts available models. Either:

- Add the model to `agents.defaults.models` in your config
- Clear the allowlist to allow all models
- Use `/model` to pick from the allowed list

## Related

- [Models CLI](/concepts/models) - Model configuration and management
- [CLI models command](/cli/models) - `crocbot models` reference
- [Model Failover](/concepts/model-failover) - Auth rotation and fallbacks
- [Model Providers](/concepts/model-providers) - Provider overview
