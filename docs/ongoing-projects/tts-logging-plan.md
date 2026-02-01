# TTS Logging Implementation Plan

## Problem

TTS processing has no visibility. During debugging, we couldn't determine if TTS was:
- Being triggered at all
- Which provider was selected
- Why it might be skipped
- API call success/failure/timing

Current logging only shows config reload events and errors.

---

## Proposed Solution

Add a dedicated `tts` subsystem logger with structured logging at key decision points.

---

## Implementation

### 1. Create TTS Subsystem Logger

**File:** `src/tts/tts.ts`

```typescript
import { createSubsystemLogger } from "../logging/subsystem.js";

const ttsLogger = createSubsystemLogger("tts");
```

### 2. Log Points to Add

| Location | Log Level | Message | Data |
|----------|-----------|---------|------|
| `maybeApplyTtsToPayload` entry | DEBUG | `tts check` | `{ autoMode, kind, textLength, hasMedia }` |
| Skip (autoMode=off) | DEBUG | `tts skipped: disabled` | `{ autoMode }` |
| Skip (text too short) | DEBUG | `tts skipped: text too short` | `{ length, minLength: 10 }` |
| Skip (has media) | DEBUG | `tts skipped: has media` | - |
| Skip (tagged mode, no tag) | DEBUG | `tts skipped: no tts tag` | - |
| Skip (inbound mode, no audio) | DEBUG | `tts skipped: no inbound audio` | - |
| Provider selected | INFO | `tts provider selected` | `{ provider, source }` |
| API call start | DEBUG | `tts api call` | `{ provider, textLength }` |
| API success | INFO | `tts generated` | `{ provider, latencyMs, outputFormat, voiceCompatible }` |
| API failure | WARN | `tts failed` | `{ provider, error }` |
| Fallback attempt | DEBUG | `tts fallback` | `{ from, to }` |
| Summarization | DEBUG | `tts summarizing` | `{ inputLength, targetLength }` |

### 3. Code Changes

**`maybeApplyTtsToPayload()` (~line 1345):**

```typescript
export async function maybeApplyTtsToPayload(params: {
  // ...
}): Promise<ReplyPayload> {
  const config = resolveTtsConfig(params.cfg);
  const prefsPath = resolveTtsPrefsPath(config);
  const autoMode = resolveTtsAutoMode({ config, prefsPath, sessionAuto: params.ttsAuto });

  ttsLogger.debug("tts check", {
    autoMode,
    kind: params.kind,
    textLength: params.payload.text?.length ?? 0,
    hasMedia: Boolean(params.payload.mediaUrl || params.payload.mediaUrls?.length),
  });

  if (autoMode === "off") {
    ttsLogger.debug("tts skipped: disabled");
    return params.payload;
  }
  // ... rest of skip conditions with similar logging
```

**`textToSpeech()` (~line 1080):**

```typescript
export async function textToSpeech(params: { ... }): Promise<TtsResult> {
  // ...
  const provider = overrideProvider ?? userProvider;
  ttsLogger.info("tts provider selected", { provider, source: overrideProvider ? "override" : "config" });

  for (const provider of providers) {
    ttsLogger.debug("tts api call", { provider, textLength: params.text.length });
    const providerStart = Date.now();
    try {
      // ... existing code ...
      ttsLogger.info("tts generated", {
        provider,
        latencyMs: Date.now() - providerStart,
        outputFormat: result.outputFormat,
        voiceCompatible: result.voiceCompatible,
      });
      return result;
    } catch (err) {
      ttsLogger.warn("tts failed", { provider, error: (err as Error).message });
      // continue to next provider
    }
  }
}
```

---

## Example Log Output

```
[tts] tts check autoMode=always kind=final textLength=142 hasMedia=false
[tts] tts provider selected provider=elevenlabs source=config
[tts] tts api call provider=elevenlabs textLength=142
[tts] tts generated provider=elevenlabs latencyMs=1832 outputFormat=opus_48000_64 voiceCompatible=true
```

Or on failure:
```
[tts] tts check autoMode=always kind=final textLength=5 hasMedia=false
[tts] tts skipped: text too short length=5 minLength=10
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/tts/tts.ts` | Add logger, add log statements |

---

## Testing

1. Send message to bot, verify logs show TTS processing
2. Send short message (<10 chars), verify skip log
3. Send message with media, verify skip log
4. Test with invalid API key, verify failure + fallback logs

---

## Effort

- **Estimate:** ~30 minutes
- **Risk:** Low (additive logging only)
- **Dependencies:** None
