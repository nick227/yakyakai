# Media Runtime

## Purpose

Every other cycle (even cycles: 2, 4, 6, …), the worker injects one Unsplash image and one YouTube video into the chat stream. The **image appears first** (before the AI plan steps) and the **video appears last** (after the AI plan steps complete). Both are persisted as normal `ChatMessage` rows and published as standard `OUTPUT` SSE events.

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

`sessionRunner.js` calls `insertMediaForCycle` twice per even cycle — once for `image` before the plan, once for `video` after.

```
runSessionJob (every cycle)
  └── insertMediaForCycle(kind='image')   ← before AI response
  └── buildPlan
  └── runPlanCycle
  └── insertMediaForCycle(kind='video')   ← after AI response
```

Gate: both calls skip when `cycle % 2 !== 0`. Odd cycles produce no media.

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
| `kind` | `video` |
| `provider` | `youtube` |
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
YOUTUBE_API_KEY=   # Google Cloud → YouTube Data API v3
```

If missing the fetch throws, the error is logged as `[media] fetch failed`, and the cycle continues without media.

---

## Known limitations

- **Race condition** — two concurrent workers on the same cycle both pass the idempotency guard. `.catch(() => {})` suppresses the duplicate `AiMediaItem`, but both workers create a `ChatMessage` and publish. Rare in practice (`AI_QUEUE_CONCURRENCY=1`).
- **No retry on failure** — a failed fetch is silently dropped; the cycle gets no video and no `AiMediaItem` row is written.
- **Non-deterministic selection** — `maxResults=1` returns the provider's current top result, which can vary between calls for the same query.
