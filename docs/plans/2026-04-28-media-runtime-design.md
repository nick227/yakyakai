## Media Runtime (Cycle-Based, Deterministic) — Design

### Goal

Add a **separate media system** that emits deterministic **image** and **video** items into the same feed as AI HTML outputs, without injecting markup into AI-generated HTML.

### Non-goals

- No changes to AI HTML schema/tags.
- No “controller” APIs like `startPlan()` / `pausePlan()` beyond existing session routes.
- No step-based cadence.

### Key requirements

- **Cycle-based cadence**: media aligns with `plan → cycle → outputs → next cycle`.
- **Deterministic selection**: no randomness.
- **Persist before publish**: client should only receive media that is already stored.
- **Idempotent on retries**: no duplicates if a worker retries.
- **Stop / pause safe**: honor `checkPlanState(sessionId)` before fetch/persist/publish.

### Cadence

- Default rule: **every 2 cycles** emit:
  - 1 image (Unsplash)
  - 1 video (YouTube)

Cadence is evaluated per `(sessionId, cycle)` when the cycle is being processed (or when a media job for that cycle runs).

### Determinism

For each media kind, compute:

- **seed input**: `sessionId + ':' + cycle + ':' + kind`
- **index**: `hash(seed) % results.length`

Persist the selected result so replay does not depend on changing upstream search results.

### Storage

Create a Prisma model:

- `AiMediaItem`
  - `sessionId` (FK)
  - `cycle` (int)
  - `kind` (`image` | `video`)
  - `provider` (`unsplash` | `youtube`)
  - `sourcePrompt` (Text, nullable): prompt/topic used to derive `query` for this cycle
  - `query` (string)
  - `selectedIndex` (int)
  - `providerAssetId` (string, nullable): provider identifier for debugging/dedupe
    - YouTube: `videoId`
    - Unsplash: `photo.id`
  - `assetJson` (LongText): provider payload (urls, ids, attribution)
  - `status` (string): `ready` | `failed`
  - `errorMessage` (Text, nullable)
  - `createdAt`

Uniqueness:

- `@@unique([sessionId, cycle, kind])`

This is the **idempotency key**.

### Idempotent create flow (persist-then-publish)

For each `(sessionId, cycle, kind)`:

1. `existing = findUnique({ where: { sessionId_cycle_kind } })`
2. If `existing`:
   - publish `EventTypes.MEDIA` using existing record
   - return
3. Else:
   - `checkPlanState(sessionId)` (stop/pause gate)
   - fetch results from provider using deterministic `query`
   - select deterministically using `hash(...)`
   - `checkPlanState(sessionId)` again
   - **persist** with `create({ data })` (may race)
   - If create fails due to unique constraint:
     - re-read existing and publish that
   - `checkPlanState(sessionId)` again
   - publish `EventTypes.MEDIA`

Publishing never happens without a persisted record.

### Provider specifics

#### YouTube

- Persist `videoId`, title/channel fields, and derived thumbnail.
- Thumbnail is deterministic:
  - `https://i.ytimg.com/vi/<videoId>/hqdefault.jpg`

#### Unsplash

- Persist `imageId`, `url`, `width`, `height`, and attribution fields required by Unsplash terms.
- Store any required “download tracking” URL if needed for later compliance.

### SSE event

Add `EventTypes.MEDIA`.

Payload:

```json
{
  "kind": "image",
  "provider": "unsplash",
  "cycle": 2,
  "asset": {
    "id": "photo_id",
    "url": "https://...",
    "width": 1200,
    "height": 800,
    "attribution": { "name": "…", "profileUrl": "…", "source": "unsplash" }
  }
}
```

```json
{
  "kind": "video",
  "provider": "youtube",
  "cycle": 2,
  "asset": {
    "videoId": "abc123",
    "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    "title": "…",
    "channelTitle": "…"
  }
}
```

### Where it runs

Media generation runs as a **parallel system** to AI:

- Implemented as its own runtime/job type (recommended) or invoked as a side-effect hook once per cycle.
- It should share `checkPlanState(sessionId)` gating and use the same SSE publish mechanism.

### Failure behavior

- If provider fetch fails:
  - Persist a `failed` record (idempotent) with `errorMessage`
  - Do not publish `EventTypes.MEDIA`
- Retry should be safe due to `@@unique([sessionId, cycle, kind])`.

