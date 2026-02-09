# src/media/

Media pipeline — handles audio, image, and video files throughout the system.

## Key Files

| File         | Purpose                                   |
| ------------ | ----------------------------------------- |
| `audio.ts`   | Audio file processing                     |
| `image.ts`   | Image processing and resizing (via sharp) |
| `video.ts`   | Video file handling                       |
| `mime.ts`    | MIME type detection                       |
| `fetch.ts`   | Media file downloading                    |
| `storage.ts` | Temp file lifecycle management            |
| `server.ts`  | HTTP media serving                        |

## How It Works

1. Media arrives from Telegram (photos, voice messages, documents, etc.)
2. Files are downloaded and stored in temp storage
3. MIME types are detected for routing
4. Images may be resized/optimized via sharp
5. Media is served via HTTP when needed by the agent

## Related

- Media understanding (AI analysis): `src/media-understanding/`
- Telegram media handling: `src/telegram/`
