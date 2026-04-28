# Media Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a deterministic, cycle-cadenced media runtime that emits persisted `MEDIA` feed items (image + video every 2 cycles) without touching AI HTML.

**Architecture:** Create an idempotent `AiMediaItem` table keyed by `(sessionId, cycle, kind)`, a media runtime that generates or re-publishes items per cycle, provider adapters (fake first, real later), and client rendering for `EventTypes.MEDIA`.

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

### Task 2: Add `EventTypes.MEDIA` end-to-end (server + client)

**Files:**
- Modify: `server/src/lib/eventTypes.js`
- Modify: `client/src/lib/eventTypes.js`
- Modify: `client/src/hooks/useOutputs.js`
- Modify: `client/src/components/ChatStream.jsx`
- Test: `client/src/lib/eventTypes.test.js` (optional) OR `server/src/tests/eventTypes.test.js` (optional)

**Step 1: Add event constant**

- Add `MEDIA: 'media'` to both server and client `EventTypes`.

**Step 2: Wire client SSE handler**

Update `useOutputs`:
- On `EventTypes.MEDIA`, append to the same `chatMessages` stream as a distinct `role` or a metadata flag (e.g. `{ isMedia: true, kind, provider }`).
- Keep it renderable without HTML injection.

**Step 3: Render media item**

Update `ChatStream.jsx`:
- If `metadata.isMedia`, render a `MediaMessage` component:
  - For image: `<img src=... />` (UI-owned, sanitized)
  - For video: thumbnail + link or embed decision (start with thumbnail link to YouTube for simplicity)

**Step 4: Commit**

- `git add server/src/lib/eventTypes.js client/src/lib/eventTypes.js client/src/hooks/useOutputs.js client/src/components/ChatStream.jsx`
- `git commit -m "Add MEDIA SSE event and client rendering."`

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
- If exists and `status==='ready'`: publish it and return
- If exists and `status==='failed'`: do nothing (or allow retry later by policy)
- Else:
  - `checkPlanState` gate
  - build `sourcePrompt` and `query`
  - provider `search`
  - deterministic pick + build `providerAssetId`
  - persist with `create`
  - on unique race: read existing
  - publish `EventTypes.MEDIA`

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

