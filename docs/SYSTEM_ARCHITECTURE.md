# System Architecture Design

This document describes the runtime architecture for session execution with focus on:

- Heartbeat presence control
- SSE event delivery
- Job queue + worker processing
- AI planning and generation pipeline

It reflects the current split-process design: API server and worker share the database, but do not share in-memory state.

## High-Level Topology

### Processes

1. `server/src/index.js` (API server)
   - Auth, REST endpoints, SSE endpoint
   - Receives heartbeat updates from client
   - Persists and streams session events
2. `server/src/worker.js` (background worker)
   - Claims jobs from DB queue
   - Runs planning + AI generation cycles
   - Publishes lifecycle/output events to DB

### Core Persistence

- MySQL via Prisma
- Primary records involved:
  - `AiSession` (status, visibility, heartbeat timestamps, prompt metadata)
  - `Job` (queued/running work units)
  - `AiSessionEvent` (ordered event stream backing SSE replay)
  - `ChatMessage` (conversation content persisted by session)

## Main Runtime Responsibilities

## 1) Heartbeat and Presence Control

Client heartbeat flow (`client/src/hooks/useSession.js`):

- Sends `POST /api/sessions/:sessionId/heartbeat` with `{ visible: boolean }`
- Uses immediate visibility beacons and interval heartbeat
- Visibility state is driven by `document.visibilityState === 'visible'`
- Hidden transitions are debounced for UX; visible transitions resume immediately

Server heartbeat handling (`server/src/routes/sessionRoutes.js`):

- Updates `AiSession.lastHeartbeatAt` on each beat
- Updates `AiSession.isVisible` from the heartbeat payload

### What presence controls

- Worker claim eligibility (session jobs only claimable when session is visible)
- Stale heartbeat cutoff safety (if heartbeat is old, session becomes ineligible)

## 2) SSE Event Streaming

SSE endpoint: `GET /api/sessions/:sessionId/events`

Responsibilities:

- Auth + session ownership enforcement
- Connection lifecycle management and per-user connection cap
- Initial `connected` event with current status
- Polls `AiSessionEvent` table and forwards ordered events
- Supports replay with `afterEventId` cursor on reconnect
- Emits heartbeat keepalive events when no new data is available

### Delivery model

- Durable event source is DB (`AiSessionEvent`)
- SSE is transport only
- Reconnect uses last received event id to avoid event gaps

## 3) Job Queue and Worker Loop

Queue service: `server/src/services/jobQueueService.js`  
Worker loop: `server/src/worker/loop.js`

### Claim model

- Worker finds next queued job and claims with `updateMany` race guard
- Session-bound jobs are claimable only when:
  - `session.isVisible = true`
  - `session.lastHeartbeatAt` is within staleness window (`SESSION_HEARTBEAT_STALE_MS`)

### Execution model

- Worker processes one claimed job
- On success: marks job complete
- On failure/retry: handled by worker processor and queue policy
- Polling/backoff loop keeps worker responsive without tight spinning

## 4) AI Planning and Generation Pipeline

Orchestration modules live under `server/src/worker` and `server/src/ai`.

Typical session cycle:

1. Start/resume route enqueues job (`session.start` or `session.cycle`)
2. Worker claims job if visibility + heartbeat gates pass
3. Planner builds/normalizes prompt plan
4. Runtime executes plan steps with AI concurrency limits
5. Worker persists outputs/messages/events
6. API SSE endpoint streams events to connected client
7. Follow-up cycle jobs are scheduled according to pace/state

## Watchdog and Safety Nets

Watchdog: `server/src/worker/watchdog.js` runs periodically from worker loop.

Safety tasks:

- Expire stale visibility:
  - Active sessions with old heartbeat are flipped to `isVisible=false`
- Reset stuck job locks
- Fail orphaned sessions with no active queued/running jobs
- Startup stale-running recovery for previously stuck sessions

These protections keep queue behavior deterministic across crashes, tab closes, and network interruptions.

## End-to-End Sequence

### Active tab normal path

1. User starts session
2. API creates `AiSession` + enqueues `session.start`
3. Client opens SSE and begins heartbeat
4. Worker claims job (visible + fresh heartbeat)
5. Worker runs AI cycle and writes events
6. API SSE relays events to client
7. Next cycle repeats while session remains visible

### Tab hidden path

1. Client sends hidden heartbeat/beacon
2. API sets `isVisible=false` and refreshes heartbeat time
3. Worker no longer claims new session jobs for that session
4. On return, client sends visible heartbeat and session becomes eligible again

### Lost client heartbeat path

1. Heartbeats stop unexpectedly
2. Staleness window elapses
3. Claim checks and watchdog both enforce invisibility
4. Session work pauses until visible heartbeat resumes

## Configuration Knobs

Key environment variables:

- `SESSION_HEARTBEAT_STALE_MS`  
  Maximum age for heartbeat freshness checks (claim and watchdog visibility expiry)
- `SSE_POLL_INTERVAL_MS`  
  Poll timing behavior in SSE stream loop
- `AI_MAX_CONCURRENT`, `AI_TIMEOUT_MS`  
  AI call runtime and concurrency governance
- `PROCESS_CONCURRENCY`  
  Worker-side processing throughput tuning

## Design Invariants

1. API and worker remain separate processes.
2. Visibility is data-driven (`AiSession.isVisible` + `lastHeartbeatAt`), not inferred in worker memory.
3. Event durability is database-backed; SSE clients can reconnect and resume.
4. Job claiming must always preserve race safety (find + guarded claim update).
5. Worker only progresses sessions that are both visible and recently heartbeating.

## Operational Debugging Checklist

When a session appears stalled:

1. Verify client is sending heartbeat (`/heartbeat` requests)
2. Confirm `AiSession.isVisible` and `lastHeartbeatAt` freshness
3. Confirm pending jobs exist and are eligible for claim
4. Check worker logs for claim/processing/watchdog warnings
5. Check SSE endpoint reconnect cursor (`afterEventId`) and event table growth

