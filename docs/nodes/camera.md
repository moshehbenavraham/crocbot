---
summary: "Camera capture via nodes for agent use: photos (jpg) and short video clips (mp4)"
read_when:
  - Adding or modifying camera capture on nodes
  - Extending agent-accessible MEDIA temp-file workflows
---

# Camera capture (agent)

crocbot supports **camera capture** for agent workflows via nodes connected to the Gateway.

Nodes can capture a **photo** (`jpg`) or **short video clip** (`mp4`, with optional audio) via `node.invoke`.

All camera access is gated behind **user-controlled settings**.

## User setting (default on)

- Node Settings → **Camera** → **Allow Camera** (`camera.enabled`)
  - Default: **on** (missing key is treated as enabled).
  - When off: `camera.*` commands return `CAMERA_DISABLED`.

## Commands (via Gateway `node.invoke`)

- `camera.list`
  - Response payload:
    - `devices`: array of `{ id, name, position, deviceType }`

- `camera.snap`
  - Params:
    - `facing`: `front|back` (default: `front`)
    - `maxWidth`: number (optional; default `1600`)
    - `quality`: `0..1` (optional; default `0.9`)
    - `format`: currently `jpg`
    - `delayMs`: number (optional; default `0`)
    - `deviceId`: string (optional; from `camera.list`)
  - Response payload:
    - `format: "jpg"`
    - `base64: "<...>"`
    - `width`, `height`
  - Payload guard: photos are recompressed to keep the base64 payload under 5 MB.

- `camera.clip`
  - Params:
    - `facing`: `front|back` (default: `front`)
    - `durationMs`: number (default `3000`, clamped to a max of `60000`)
    - `includeAudio`: boolean (default `true`)
    - `format`: currently `mp4`
    - `deviceId`: string (optional; from `camera.list`)
  - Response payload:
    - `format: "mp4"`
    - `base64: "<...>"`
    - `durationMs`
    - `hasAudio`

## Foreground requirement

Nodes only allow `camera.*` commands in the **foreground**. Background invocations return `NODE_BACKGROUND_UNAVAILABLE`.

## CLI helper (temp files + MEDIA)

The easiest way to get attachments is via the CLI helper, which writes decoded media to a temp file and prints `MEDIA:<path>`.

Examples:

```bash
crocbot nodes camera snap --node <id>               # default: both front + back (2 MEDIA lines)
crocbot nodes camera snap --node <id> --facing front
crocbot nodes camera clip --node <id> --duration 3000
crocbot nodes camera clip --node <id> --no-audio
```

Notes:
- `nodes camera snap` defaults to **both** facings to give the agent both views.
- Output files are temporary (in the OS temp directory) unless you build your own wrapper.

## Safety + practical limits

- Camera and microphone access trigger the usual OS permission prompts.
- Video clips are capped (currently `<= 60s`) to avoid oversized node payloads (base64 overhead + message limits).
