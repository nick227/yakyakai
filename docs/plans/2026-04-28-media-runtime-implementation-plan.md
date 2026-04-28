# Media Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a deterministic, cycle-cadenced media runtime that emits persisted **media `ChatMessage` rows** (image + video every 2 cycles) so the client renders them as normal chat history HTML.

**Architecture:** Create an idempotent `AiMediaItem` table keyed by `(sessionId, cycle, kind)`, a media runtime that generates or re-publishes items per cycle, provider adapters (fake first, real later), and a deterministic embed-html builder that stores the result as a normal `ChatMessage` (with media metadata) and publishes it through the existing SSE message pathway.

**Tech Stack:** Node (ESM), Express, Prisma (MySQL), SSE events, React client.

---

### Task 1: Add `AiMediaItem` Prisma model (idempotent storage)

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/<timestamp>_add_ai_media_item/migration.sql` (via Prisma migrate)
- Test: `server/src/tests/aiMediaItem.test.js` (new)

**Step 1: Write the failing test**

Create `server/src/tests/aiMediaItem.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { prisma } from '../db/prisma.js'

describe('AiMediaItem uniqueness', () => {
  it('enforces unique sessionId+cycle+kind', async () => {
    const session = await prisma.aiSession.create({
      data: { userId: (await prisma.user.create({ data: { email: `t-${Date.now()}@x.com` } })).id, originalPrompt: 'x' }
    })

    await prisma.aiMediaItem.create({
      data: {
        sessionId: session.id,
        cycle: 2,
        kind: 'image',
        provider: 'unsplash',
        sourcePrompt: 'x',
        query: 'x',
        selectedIndex: 0,
        providerAssetId: 'p1',
        assetJson: JSON.stringify({}),
        status: 'ready',
      },
    })

    await expect(
      prisma.aiMediaItem.create({
        data: {
          sessionId: session.id,
          cycle: 2,
          kind: 'image',
          provider: 'unsplash',
          sourcePrompt: 'x',
          query: 'x',
          selectedIndex: 0,
          providerAssetId: 'p1',
          assetJson: JSON.stringify({}),
          status: 'ready',
        },
      })
    ).rejects.toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run (server):
- `npm run test:run`

Expected: FAIL because `aiMediaItem` model doesn’t exist.

**Step 3: Add model to schema**

Add to `server/prisma/schema.prisma`:
- `model AiMediaItem { ... @@unique([sessionId, cycle, kind]) }`
- Fields from the approved design:
  - `sessionId`, `cycle`, `kind`, `provider`
  - `sourcePrompt` (`@db.Text`)
  - `query`
  - `selectedIndex`
  - `providerAssetId`
  - `assetJson` (`@db.LongText`)
  - `status` default `ready`
  - `errorMessage` (`@db.Text`)
  - `createdAt`

**Step 4: Create migration + regenerate Prisma client**

Run:
- `npx prisma migrate dev -n add_ai_media_item`
- `npx prisma generate`

Expected: migration created and applied.

**Step 5: Re-run tests**

Run:
- `npm run test:run`

Expected: PASS.

**Step 6: Commit**

Run:
- `git add server/prisma/schema.prisma server/prisma/migrations server/src/tests/aiMediaItem.test.js`
- `git commit -m "Add AiMediaItem table for deterministic media."`

---

### Task 2: Allow deterministic media embed HTML in chat history

**Files:**
- Modify: `client/src/hooks/useOutputs.js` (if needed; depends on how chat messages are streamed today)
- Modify: `client/src/components/ChatStream.jsx` (if needed; mostly should already render assistant HTML)
- Modify: `client` sanitization policy (DOMPurify usage) to explicitly allow the chosen tags/attrs for embeds

**Step 1: Decide allowed embed strategy**

Start minimal and safe:
- **Image**: `<img src>` inside a small wrapper.
- **Video**: thumbnail `<img>` linking to YouTube (no `<iframe>` initially).

This avoids expanding sanitizer surface area to iframes on day 1.

**Step 2: Update client sanitization**

Wherever assistant HTML is sanitized (DOMPurify usage), ensure it allows:
- tags: `img`, `figure`, `figcaption`, `a` (if used)
- attrs: `src`, `alt`, `href`, `rel`, `target`, `loading`, `referrerpolicy`

**Step 3: Rendering**

No special renderer required if these messages are normal assistant chat messages.
Optionally style media messages by checking `metadata.isMedia`.

**Step 4: Commit**

- `git add client/src/hooks/useOutputs.js client/src/components/ChatStream.jsx <the file where DOMPurify config lives>`
- `git commit -m "Allow deterministic media embeds in chat HTML."`

---

### Task 3: Deterministic selection helpers (hash + pick)

**Files:**
- Create: `server/src/media/determinism.js`
- Test: `server/src/tests/determinism.test.js`

**Step 1: Write failing test**

Create `server/src/tests/determinism.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { pickDeterministicIndex } from '../media/determinism.js'

describe('pickDeterministicIndex', () => {
  it('is stable for same inputs', () => {
    expect(pickDeterministicIndex('s1', 2, 'image', 10)).toBe(pickDeterministicIndex('s1', 2, 'image', 10))
  })
  it('stays in bounds', () => {
    const idx = pickDeterministicIndex('s1', 2, 'image', 3)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(3)
  })
})
```

**Step 2: Implement minimal helper**

Implement `pickDeterministicIndex(sessionId, cycle, kind, length)` using a stable hash (e.g. Node `crypto.createHash('sha256')`) and modulo.

**Step 3: Commit**

- `git add server/src/media/determinism.js server/src/tests/determinism.test.js`
- `git commit -m "Add deterministic selection helper for media."`

---

### Task 4: Fake provider adapters (no external APIs yet)

**Files:**
- Create: `server/src/media/providers/unsplashFake.js`
- Create: `server/src/media/providers/youtubeFake.js`
- Create: `server/src/media/providers/index.js`

**Step 1: Implement fake provider search**

Each adapter exports `search({ query, limit })` returning a stable list of results with:
- Unsplash-like: `{ id, url, width, height, attribution }`
- YouTube-like: `{ videoId, title, channelTitle }` (+ derived thumbnail later)

No env keys needed at this stage.

**Step 2: Commit**

- `git add server/src/media/providers`
- `git commit -m "Add fake media provider adapters."`

---

### Task 5: Media runtime (idempotent persist-then-publish)

**Files:**
- Create: `server/src/media/mediaRuntime.js`
- Create: `server/src/media/mediaService.js`
- Modify: `server/src/worker/sessionRunner.js` (hook point) OR `server/src/worker/jobProcessor.js` (separate job type)
- Test: `server/src/tests/mediaRuntime.test.js`

**Step 1: Choose execution mode**

Start with the smallest incremental hook:
- After `runPlanCycle` completes a cycle (or at cycle start), call `ensureMediaForCycle({ sessionId, cycle })` for `image` and `video` if `cycle % 2 === 0`.

Later, this can become its own job type.

**Step 2: Implement `ensureMediaItem`**

Algorithm per `(sessionId, cycle, kind)`:
- `findUnique` by composite key
- If exists and `status==='ready'`:
  - ensure corresponding `ChatMessage` exists (idempotent)
  - publish that `ChatMessage` like a normal assistant message
  - return
- If exists and `status==='failed'`: do nothing (or allow retry later by policy)
- Else:
  - `checkPlanState` gate
  - build `sourcePrompt` and `query`
  - provider `search`
  - deterministic pick + build `providerAssetId`
  - persist with `create`
  - on unique race: read existing
  - create media `ChatMessage` with deterministic embed HTML + metadata
  - publish that `ChatMessage` like a normal assistant message

On provider failure:
- persist `status='failed'` with `errorMessage`
- do not publish

**Step 3: Write tests**

`mediaRuntime.test.js` should assert:
- second call does not create duplicates (idempotent)
- publish uses existing record on re-run

**Step 4: Commit**

- `git add server/src/media server/src/worker/sessionRunner.js server/src/tests/mediaRuntime.test.js`
- `git commit -m "Add deterministic media runtime with idempotent storage."`

---

### Task 6: Wire real providers (Unsplash + YouTube)

**Files:**
- Create: `server/src/media/providers/unsplash.js`
- Create: `server/src/media/providers/youtube.js`
- Modify: `server/.env.example`

**Step 1: Add env vars**

- `UNSPLASH_ACCESS_KEY` (and others if needed)
- `YOUTUBE_API_KEY`

**Step 2: Implement API calls**

- Unsplash: search endpoint, map to stable result objects, include attribution fields.
- YouTube: search endpoint to get `videoId` and metadata.

Keep determinism by selecting with the same hash+mod and then persisting.

**Step 3: Commit**

- `git add server/src/media/providers server/.env.example`
- `git commit -m "Wire Unsplash and YouTube providers for media runtime."`

---

### Task 7: Manual verification script (stoppable/startable)

**Files:**
- None required (optional: add a small admin-only endpoint later)

**Step 1: Verify stop/pause behavior**

- Start a session, wait until a media cycle triggers
- Pause session during media fetch (or immediately after trigger)
- Expect: no new `MEDIA` event after pause, and no `ready` record created unless it was already persisted before pause

**Step 2: Verify idempotency**

- Trigger the same cycle twice (simulate retry)
- Expect: only one DB row per `(sessionId, cycle, kind)` and publishing reuses it

---

## Plan complete

Saved to `docs/plans/2026-04-28-media-runtime-implementation-plan.md`.

Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** — Open a new session and execute with checkpoints using superpowers:executing-plans.

Which approach?

