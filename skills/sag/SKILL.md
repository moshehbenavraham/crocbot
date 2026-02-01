---
name: sag
description: ElevenLabs text-to-speech with mac-style say UX.
homepage: https://sag.sh
metadata: {"crocbot":{"emoji":"🗣️","requires":{"bins":["sag"],"env":["ELEVENLABS_API_KEY"]},"primaryEnv":"ELEVENLABS_API_KEY","install":[{"id":"brew","kind":"brew","formula":"steipete/tap/sag","bins":["sag"],"label":"Install sag (brew)"}]}}
---

# sag

Use `sag` for ElevenLabs TTS with local playback.

API key (required)
- `ELEVENLABS_API_KEY` (preferred)
- `SAG_API_KEY` also supported by the CLI

Quick start
- `sag "Hello there"`
- `sag speak -v "Roger" "Hello"`
- `sag voices`
- `sag prompting` (model-specific tips)

Model notes
- Default: `eleven_v3` (expressive)
- Stable: `eleven_multilingual_v2`
- Fast: `eleven_flash_v2_5`

Pronunciation + delivery rules
- First fix: respell (e.g. "key-note"), add hyphens, adjust casing.
- Numbers/units/URLs: `--normalize auto` (or `off` if it harms names).
- Language bias: `--lang en|de|fr|...` to guide normalization.
- v3: SSML `<break>` not supported; use `[pause]`, `[short pause]`, `[long pause]`.
- v2/v2.5: SSML `<break time="1.5s" />` supported; `<phoneme>` not exposed in `sag`.

## v3 Audio Tags

Audio Tags are inline directives in square brackets `[]` that add emotional nuance, tone shifts, non-verbal sounds, and effects to generated speech. Place them anywhere in the text—before, after, or mid-sentence.

**Syntax:**
- Use lowercase for consistency (case-insensitive)
- Combine tags like `[nervous][whispers]` for layered effects
- Tags persist until overridden by a new tag or the segment ends
- No explicit terminator like `[/tag]` exists
- Punctuation like ellipses (…) or CAPS boosts emphasis alongside tags
- Best results with prompts >250 characters

**Tag Categories:**

| Category | Examples |
|----------|----------|
| Emotions | `[happy]`, `[sad]`, `[angry]`, `[curious]`, `[sarcastic]`, `[excited]`, `[nervous]` |
| Delivery | `[whispers]`, `[shouts]`, `[sings]`, `[strong French accent]` |
| Non-verbal | `[laughs]`, `[sighs]`, `[clears throat]`, `[breathing heavily]`, `[exhales]` |
| Pacing | `[pause]`, `[short pause]`, `[long pause]` |
| Effects | `[gunshot]`, `[applause]`, `[explosion]` (experimental) |

**Examples:**
```bash
sag "[whispers] This is secret... [excited] But it works!"
sag "[nervous][whispers] I'm not sure about this. [pause] Ok, let's do it."
sag "[sarcastic] Oh wow, that's SO impressive. [laughs]"
```

**Notes:**
- Works best with Creative or Natural stability settings
- Results vary by voice training data
- v3 does NOT support SSML `<break>` tags; use `[pause]` instead

Voice defaults
- `ELEVENLABS_VOICE_ID` or `SAG_VOICE_ID`

Confirm voice + speaker before long output.

## Chat voice responses

> **NOTE: sag skill vs Auto-TTS**
> This skill is for AGENT-INVOKED voice generation (when the AI explicitly runs `sag`).
> This is SEPARATE from the built-in Auto-TTS system (`messages.tts.auto` in config).
> - **sag skill**: AI explicitly generates voice via `sag` CLI command
> - **Auto-TTS**: Automatic voice conversion of all replies (see `src/tts/tts.ts`)
> Both should use the same voice ID for consistency.

When the user asks for a "voice" reply (e.g., "crazy scientist voice", "explain in voice"), generate audio and send it:

```bash
# Generate audio file (use voice ID directly for consistency with auto-TTS)
sag --voice-id ZD29qZCdYhhdqzBLRKNH -o /tmp/voice-reply.mp3 "Your message here"

# Then include in reply:
# MEDIA:/tmp/voice-reply.mp3
```

Voice character tips:
- Crazy scientist: Use `[excited]` tags, dramatic pauses `[short pause]`, vary intensity
- Calm: Use `[whispers]` or slower pacing
- Dramatic: Use `[sings]` or `[shouts]` sparingly

Default voice: `ZD29qZCdYhhdqzBLRKNH` ("Female Humanoid - Futuristic")
https://elevenlabs.io/app/voice-library?voiceId=ZD29qZCdYhhdqzBLRKNH
