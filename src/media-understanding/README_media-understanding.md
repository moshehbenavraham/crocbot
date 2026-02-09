# src/media-understanding/

AI-powered media analysis — applies vision and audio models to process attachments.

## Structure

```
media-understanding/
  providers/          # Provider-specific implementations
    anthropic/        # Claude vision
    deepgram/         # Deepgram speech-to-text
    google/           # Google Cloud media APIs
    groq/             # Groq transcription
    minimax/          # Minimax media processing
    openai/           # OpenAI Whisper and vision
```

## How It Works

When media is attached to a message, this module:

1. Detects the media type (image, audio, video)
2. Routes to the appropriate provider
3. Runs analysis (vision description, transcription, etc.)
4. Returns structured results to the agent context

## Supported Capabilities

- **Image understanding** — Claude vision, OpenAI vision
- **Audio transcription** — Deepgram, Groq, OpenAI Whisper
- **Video analysis** — Frame extraction + vision

## Related

- Media pipeline: `src/media/`
- Provider auth: `src/providers/`
