# Media Runtime Implementation Plan

**Goal:** Add idempotency to the existing media runtime so retried or replayed cycles never produce duplicate `ChatMessage` rows or duplicate SSE events.

**What's already working:**
- `server/src/media/insertMediaForCycle.js` — fetches Unsplash + YouTube, creates `ChatMessage` rows, publishes `EventTypes.OUTPUT` events
- `server/src/worker/sessionRunner.js` — calls `insertMediaForCycle()` before plan building on every cycle
- `client/src/components/ChatStream.jsx` — detects `metadata.isMedia` and renders media messages with the correct DOMPurify config
- Media runs on even cycles only (`cycle % 2 === 0`)

**The problem:** `insertMediaForCycle` has no deduplication. A retry or worker restart on the same cycle creates duplicate DB rows and fires duplicate SSE events.

**The fix:** Add an `AiMediaItem` table keyed on `(sessionId, cycle, kind)`. Check it before fetching; persist after fetching; skip if the row already exists.

---

### Task 1: Fix .env.example

`UNSPLASH_ACCESS_KEY` and `YOUTUBE_API_KEY` are required by `insertMediaForCycle.js` but missing from `server/.env.example`.

Add them to `server/.env.example`:

```
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here
```

Commit:
```
git add server/.env.example
git commit -m "Document UNSPLASH_ACCESS_KEY and YOUTUBE_API_KEY in .env.example"
```

---

### Task 2: Add `AiMediaItem` Prisma model

**File:** `server/prisma/schema.prisma`

Add the model:

```prisma
model AiMediaItem {
  id              Int      @id @default(autoincrement())
  sessionId       String
  cycle           Int
  kind            String   // 'image' | 'video'
  provider        String   // 'unsplash' | 'youtube'
  query           String
  providerAssetId String
  assetJson       String   @db.LongText
  htmlContent     String   @db.LongText
  status          String   @default("ready")
  errorMessage    String?  @db.Text
  createdAt       DateTime @default(now())

  @@unique([sessionId, cycle, kind])
}
```

Run:
```
npx prisma migrate dev -n add_ai_media_item
npx prisma generate
```

Add test `server/src/tests/api/aiMediaItem.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '../../db/prisma.js'

describe('AiMediaItem uniqueness', () => {
  let sessionId

  afterEach(async () => {
    if (sessionId) {
      await prisma.aiMediaItem.deleteMany({ where: { sessionId } })
      await prisma.aiSession.deleteMany({ where: { id: sessionId } })
    }
  })

  it('enforces unique sessionId+cycle+kind', async () => {
    const user = await prisma.user.create({ data: { email: `t-${Date.now()}@x.com` } })
    const session = await prisma.aiSession.create({
      data: { userId: user.id, originalPrompt: 'x' },
    })
    sessionId = session.id

    const base = {
      sessionId,
      cycle: 2,
      kind: 'image',
      provider: 'unsplash',
      query: 'nature',
      providerAssetId: 'abc',
      assetJson: '{}',
      htmlContent: '<img src="x">',
    }

    await prisma.aiMediaItem.create({ data: base })
    await expect(prisma.aiMediaItem.create({ data: base })).rejects.toBeTruthy()
  })
})
```

Run:
```
npm run test:run
```

Commit:
```
git add server/prisma/schema.prisma server/prisma/migrations server/src/tests/api/aiMediaItem.test.js
git commit -m "Add AiMediaItem table for idempotent media tracking"
```

---

### Task 3: Refactor `insertMediaForCycle` to use `AiMediaItem`

**File:** `server/src/media/insertMediaForCycle.js`

Replace the current fire-and-forget fetch+create with a check-then-persist pattern:

**Algorithm per `(sessionId, cycle, kind)`:**
1. `findUnique` on `AiMediaItem` by `(sessionId, cycle, kind)`
2. If `status === 'ready'`: skip fetch, use `item.htmlContent` to upsert the `ChatMessage` (find by `messageId` stored in metadata, or check for existing media message for this cycle+kind), then publish
3. If `status === 'failed'`: skip silently
4. If not found:
   - Fetch from provider
   - Persist `AiMediaItem` with `status: 'ready'`
   - On unique constraint race: read existing row and use it
   - Create `ChatMessage` using `item.htmlContent`
   - Publish

On provider fetch error:
- Persist `AiMediaItem` with `status: 'failed'`, `errorMessage`
- Do not publish

**Key change:** `ChatMessage` content is always derived from `AiMediaItem.htmlContent` — never from a fresh provider response. This ensures idempotency on replay.

Commit:
```
git add server/src/media/insertMediaForCycle.js
git commit -m "Refactor insertMediaForCycle to use AiMediaItem for idempotency"
```

---

### Task 4: Manual verification

1. Start a session, let it reach an even cycle, confirm media messages appear once
2. Simulate retry: call `insertMediaForCycle` twice for the same cycle in the test environment — assert only one `AiMediaItem` row and one `ChatMessage` pair per cycle+kind
3. Kill and restart the worker mid-cycle, confirm no duplicates on resume

---

## Out of scope (already done)

- DOMPurify config — already allows `img`, `src`, `href`, `target`, `rel`, `loading` for media messages
- ChatStream rendering — already branches on `metadata.isMedia`
- Unsplash + YouTube provider code — already implemented
- sessionRunner hook — already calls `insertMediaForCycle` before plan building
- Even-cycle-only gate — already in place (`cycle % 2 !== 0` early return)
