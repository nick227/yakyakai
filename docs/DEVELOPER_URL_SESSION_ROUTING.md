# Developer: URL and Session Routing

This document describes the **current** URL/session routing model, control-flow behavior, and key guarantees in YakyakAI.

## Goals

- Treat `/:sessionId` as the canonical identity of a chat.
- Keep valid session URLs reload-safe (history pages, not just live runs).
- Keep streaming tied to session state transitions (`queued`, `planning`, `running`, `paused`, `stopped`, `completed`, `failed`).
- Preserve deterministic control behavior for pause/stop.

## Route Model

### Client URL shapes

- `/` -> new chat composer (no active session selected)
- `/:sessionId` -> load and display that session (history + live state when active)

### Session id resolution

Client resolves session id from path first, then falls back to local storage when path has no session id.

## Client Routing Flow

Main routing logic lives in `client/src/App.jsx`.

- Initial state:
  - `sessionId` comes from URL (`getSessionIdFromUrl()`), fallback to local storage.
- Starting a run:
  - client creates session via `POST /api/sessions/start`
  - on success, pushes URL to `/:sessionId` and sets active `sessionId`
- New chat:
  - clears state and pushes URL to `/`
- Browser navigation:
  - `popstate` listener updates `sessionId` from URL

## Session Loading Rules

Session loading lives in `client/src/hooks/useSession.js`.

- `GET /api/sessions/:sessionId` hydrates current status/metadata.
- Valid owned sessions remain routable even when terminal:
  - `paused`, `stopped`, `cancelled`, `completed`, `failed` all remain history pages.
- Route is cleared only for true invalid/inaccessible cases:
  - `401`, `403`, `404`, validation error / malformed id

## Status Normalization

User-facing status normalization in client:

- backend `cancelled` is mapped to UI status `stopped`

This keeps one user-facing terminal semantic for user-triggered halts.

## SSE Lifecycle

SSE endpoint: `GET /api/sessions/:sessionId/events`

### Server behavior

In `server/src/routes/sessionRoutes.js`:

- emits initial `connected` event with session status
- polls `aiSessionEvent` table and streams ordered events
- includes `eventId` in each emitted event
- supports `afterEventId` query for resume cursor

### Client behavior

In `client/src/hooks/useSession.js`:

- opens EventSource with optional `afterEventId` resume cursor
- records last seen `eventId`
- dedupes by `eventId`
- reconnects at most once on transient failure
- stops reconnecting on terminal status

## Pause / Stop Control Flow

Control endpoints in `server/src/routes/sessionRoutes.js`:

- `POST /:sessionId/pause`
- `POST /:sessionId/stop`
- `POST /:sessionId/cancel` (compat alias)
- `POST /:sessionId/resume`

### Stop semantics

On stop:

1. queued jobs for the session are cancelled
2. session status is set to `cancelled`
3. active in-flight AI call is aborted (`abortSessionAiCall`)
4. `STATUS: stopped` event is persisted to `aiSessionEvent`
5. client receives terminal state and closes SSE

### Determinism guard

In `server/src/worker/processing.js`, after an AI call returns and before persistence:

- worker re-reads session status
- if paused/cancelled, exits without persisting/publishing extra output

This prevents post-stop output leakage.

## Serial Backpressure Execution

Processing loop runs one prompt at a time (no batch parallelism):

1. status checkpoint
2. start prompt
3. one AI call
4. persist output/message
5. emit output event
6. checkpoint before next prompt

Pause/stop takes effect at checkpoint boundaries and via in-flight abort.

## Session History and Message Identity

### History guarantee

Session URLs are permanent history pages for valid owned sessions. Reloading `/:sessionId` should restore history and state.

### Message identity reconciliation

Start flow now supports client/server identity linking:

- client sends `clientId` with `/start`
- server stores user message metadata with `clientId`
- hydration maps:
  - `serverId` from persisted message id
  - `clientId` from metadata

This enables optimistic->persisted reconciliation without duplicate identity ambiguity.

## Session List API (Sidebar)

Endpoint: `GET /api/sessions?take=<n>&cursor=<id>`

- sorted by `updatedAt desc, id desc`
- returns `sessions` and `nextCursor`
- sidebar consumes cursor pagination and appends on scroll

DB support index in Prisma:

- `AiSession @@index([userId, updatedAt, id])`

## Delete Semantics

Deleting a session (`DELETE /api/sessions/:sessionId`) performs:

1. abort active session call
2. delete session-scoped jobs
3. delete `AiSession` record (cascades messages/outputs/events)

Prevents orphan queued jobs and preserves cascade correctness.

## Worker Crash Recovery

On worker startup (`server/src/worker.js`):

- `recoverStaleRunningSessions()` runs before processing loop
- stale active sessions (`planning/running/expanding/cycling`) are marked failed
- related jobs are cancelled

Prevents sessions from being stuck forever in active statuses after crash/restart.

## Practical Debug Checklist

When routing/session behavior looks wrong, verify in order:

1. URL path has expected `sessionId`
2. `GET /api/sessions/:id` returns owned session
3. SSE `connected` received once with expected status
4. `STATUS` events are written to `aiSessionEvent` (not just in-memory)
5. `eventId` increases and client `afterEventId` advances after reconnect
6. stop/pause transitions set session status in DB and emit status event
7. no output persisted after a terminal stop checkpoint

