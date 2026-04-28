# Media Runtime

## Purpose

The worker injects media into the chat stream:
- **Image** (`unsplash`) each cycle
- **Video** (`youtube`) each cycle
- **GIF** (`giphy`) every other cycle (even cycles: 2, 4, 6, ...)

Each media item is persisted as a normal `ChatMessage` row and published as a standard `OUTPUT` SSE event.

**What the user sees:**
```
User: "I want to learn about ocean conservation"

[Unsplash photo]          ← start of even cycle, before AI response
AI plan step 1 ...
AI plan step 2 ...
[YouTube video]           ← end of even cycle, after AI response
```

---

## Trigger

`sessionRunner.js` calls `insertMediaForCycle` for `image`, `video`, and `giphy` each cycle.

```
runSessionJob (every cycle)
  └── insertMediaForCycle(kind='image')
  └── insertMediaForCycle(kind='video')
  └── insertMediaForCycle(kind='giphy')
  └── buildPlan
  └── runPlanCycle
```

Gate: `giphy` skips when `cycle % 2 !== 0`. Odd cycles produce no GIF.

---

## Execution flow

```
insertMediaForCycle(kind)   ← called separately for 'image' and 'video'
  │
  ├── [skip] odd cycle
  ├── [skip] session paused or cancelled
  │
  ├── AiMediaItem.findUnique (sessionId, cycle, kind)   ← idempotency check
  │
  ├── [skip] row already exists
  │
  ├── fetchUnsplashImage(query)   if kind='image'
  ├── fetchYouTubeVideo(query)    if kind='video'
  ├── fetchGiphy(query)           if kind='giphy'
  │
  ├── [return silently] fetch error or session blocked
  │
  ├── AiMediaItem.create   .catch(() => {}) absorbs race dupes
  │
  ├── ChatMessage.create
  │
  └── publish OUTPUT event   → client appends to chat
```

`query` = `session.currentPrompt || session.originalPrompt`, truncated to 90 chars.

---

## AiMediaItem table

Idempotency record. Prevents duplicate `ChatMessage` rows and duplicate SSE events if the worker retries the same cycle.

| Field | Value |
|---|---|
| `sessionId` + `cycle` + `kind` | Unique composite key |
| `kind` | `image` / `video` / `giphy` |
| `provider` | `unsplash` / `youtube` / `giphy` |
| `query` | Search string used |
| `providerAssetId` | YouTube video ID |
| `assetJson` | Raw provider response |
| `htmlContent` | HTML written into the `ChatMessage` |

---

## ChatMessage shape

```json
{
  "role": "ASSISTANT",
  "content": "<iframe src=\"https://www.youtube.com/embed/VIDEO_ID\" ...></iframe>",
  "metadata": { "isMedia": true, "kind": "video", "provider": "youtube", "cycle": 2 }
}
```

---

## HTML output

```html
<iframe src="https://www.youtube.com/embed/VIDEO_ID" class="w-full aspect-video"
  frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen></iframe>
```

---

## Client rendering

`ChatStream.jsx` checks `metadata.isMedia`. When true, renders the stored HTML via `dangerouslySetInnerHTML` with a DOMPurify config that allows `iframe`, `img`, `src`, `allowfullscreen`, `frameborder`, `allow`, `target`, `rel`, `loading`, `referrerpolicy`.

`sortedMessages` always places USER role messages before ASSISTANT messages, so the user's prompt is never displaced by media.

---

## Environment variables

```
UNSPLASH_ACCESS_KEY=  # Unsplash API
YOUTUBE_API_KEY=   # Google Cloud → YouTube Data API v3
GIPHY_API_KEY=     # Giphy API
```

If missing the fetch throws, the error is logged as `[media] fetch failed`, and the cycle continues without media.

---

## Known limitations

- **Race condition** — two concurrent workers on the same cycle both pass the idempotency guard. `.catch(() => {})` suppresses the duplicate `AiMediaItem`, but both workers create a `ChatMessage` and publish. Rare in practice (`AI_QUEUE_CONCURRENCY=1`).
- **No retry on failure** — a failed fetch is silently dropped; the cycle gets no video and no `AiMediaItem` row is written.
- **Non-deterministic selection** — `maxResults=1` returns the provider's current top result, which can vary between calls for the same query.
