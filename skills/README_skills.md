# skills/

Bundled skills that extend the crocbot agent's capabilities. Each skill is a directory containing a `SKILL.md` manifest and optional supporting scripts.

## Available Skills

| Skill | Description |
|-------|-------------|
| `bird/` | Bird identification |
| `coding-agent/` | Code generation and editing |
| `discord/` | Discord integration |
| `food-order/` | Food ordering assistance |
| `gifgrep/` | GIF search |
| `github/` | GitHub operations |
| `gog/` | GOG gaming platform |
| `goplaces/` | Location/places lookup |
| `mcporter/` | MCP (Model Context Protocol) helper |
| `nano-banana-pro/` | Nano Banana Pro device control |
| `nano-pdf/` | PDF generation |
| `notion/` | Notion integration |
| `obsidian/` | Obsidian vault operations |
| `openai-image-gen/` | OpenAI image generation (DALL-E) |
| `openai-whisper/` | OpenAI Whisper transcription (local) |
| `openai-whisper-api/` | OpenAI Whisper transcription (API) |
| `ordercli/` | Order management CLI |
| `sag/` | Search and gather |
| `self-repair/` | Self-repair diagnostics |
| `session-logs/` | Session log management |
| `skill-creator/` | Skill authoring helper |
| `slack/` | Slack integration |
| `songsee/` | Song identification |
| `spotify-player/` | Spotify playback control |
| `summarize/` | Text summarization |
| `tmux/` | Tmux session management |
| `trello/` | Trello board operations |
| `video-frames/` | Video frame extraction |
| `voice-call/` | Voice call management |
| `weather/` | Weather lookup |

## Skill Structure

Each skill directory typically contains:

- `SKILL.md` — The skill manifest (instructions, triggers, tool definitions)
- `scripts/` — Optional helper scripts (Python, shell, etc.)

## How Skills Are Loaded

Skills are discovered and loaded by `src/agents/skills/`. They can be:
- **Bundled** — shipped in this directory with the package
- **Managed** — installed at runtime
- **Workspace** — user-defined in the agent workspace (`~/croc/skills/`)
