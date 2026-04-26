# YakyakAI Server — Developer Guide

## Overview

The server is a Node.js/Express application split into two independent processes:

| Process | Entry point | Role |
|---|---|---|
| **HTTP server** | `src/index.js` | Serves REST API, SSE event streams, auth |
| **Job worker** | `src/worker.js` | Processes AI jobs, drives the session lifecycle |

The two processes share a MySQL database (via Prisma) and an in-memory event bus. The worker writes to the database and publishes to the bus; the HTTP server reads from the database and relays bus events to connected clients over SSE.

---

## Directory Layout

```
server/src/
├── index.js              # HTTP server entry point
├── worker.js             # AI job processing loop
├── db/
│   └── prisma.js         # Singleton Prisma client
├── routes/
│   ├── index.js          # Mounts all route groups under /api
│   ├── authRoutes.js     # /api/auth — login, register, me, logout
│   ├── sessionRoutes.js  # /api/sessions — start, events (SSE), heartbeat, pause/resume/stop
│   ├── adminRoutes.js    # /api/admin — queue, jobs, online users, force-stop
│   ├── usageRoutes.js    # /api/usage — monthly token stats
│   ├── dashboardRoutes.js
│   ├── exportRoutes.js
│   ├── intelligenceRoutes.js
│   ├── jobRoutes.js
│   ├── memoryRoutes.js
│   ├── plannerRoutes.v3_6.js
│   ├── recoveryRoutes.js
│   ├── runtimeRoutes.v5.js
│   └── topicAdjacentRoutes.js
├── services/
│   ├── bus.js            # In-memory pub/sub (EventEmitter per session)
│   ├── aiGovernor.js     # Concurrency semaphore + timeout
│   ├── openaiClient.js   # OpenAI SDK wrapper
│   ├── usageService.js   # Token accounting + limits + TTL cache
│   ├── jobQueueService.js # Durable job queue (create, claim, complete, fail)
│   ├── jobEventService.js # Job audit log entries
│   ├── jobStateService.js # Session/job state machine
│   └── ...               # Feature services (planner, analytics, memory, etc.)
├── agents/
│   └── plannerAgent.js   # Planner output normalizer
├── middleware/
│   ├── auth.js           # requireAuth / optionalAuth (JWT from httpOnly cookie)
│   ├── permissions.js    # requireAdmin, assertOwnsSession
│   └── errorMiddleware.js # notFoundHandler, errorHandler
├── lib/
│   ├── eventTypes.js     # SSE event type constants
│   ├── pace.js           # Pace → delay ms mapping
│   ├── route.js          # Async route wrapper (catches thrown errors)
│   ├── validation.js     # Input validators
│   ├── httpError.js      # createHttpError helper
│   └── logger.js         # Structured logger
├── config/
│   ├── usageLimits.js    # Per-plan token and prompt limits
│   └── agents.js
├── prompts/
│   └── plannerPrompt.v3_6.js
└── utils/
    ├── tokenEstimate.js  # Rough character → token estimate
    └── monthWindow.js    # Returns {start, end} for the current calendar month
```

---

## The Full Request Lifecycle

```
Client                HTTP Server              Database           Worker
  │                       │                       │                  │
  │── POST /api/sessions/start ──────────────────>│                  │
  │                       │── INSERT AiSession ──>│                  │
  │                       │── INSERT Job ────────>│                  │
  │<── 201 { sessionId } ─│                       │                  │
  │                       │                       │                  │
  │── GET /api/sessions/:id/events (SSE) ────────>│                  │
  │<── "connected" event ─│                       │                  │
  │                       │                       │                  │
  │                       │               (poll every 600ms)         │
  │                       │                       │<── claimNextJob ─│
  │                       │                       │─── Job row ─────>│
  │                       │                       │                  │── plan AI call
  │                       │                       │                  │── INSERT AiOutput
  │<── "plan" SSE event ──│<── bus.publish ───────────────────────── │
  │<── "output" SSE event─│<── bus.publish ───────────────────────── │
  │<── "status" cycling ──│<── bus.publish ───────────────────────── │
  │                       │                       │<── INSERT Job ───│  (next cycle)
```

---

## HTTP Server (`src/index.js`)

Express app on `PORT` (default `3001`).

**Middleware stack** (in order):
1. `cors` — allows requests from `CLIENT_ORIGIN` (default `http://localhost:5173`) with credentials
2. `express.json({ limit: '1mb' })` — JSON body parsing
3. `cookieParser` — reads the auth cookie

**Route groups** mounted under `/api` via `routes/index.js`:

| Prefix | File | Notes |
|---|---|---|
| `/api/auth` | `authRoutes.js` | Public + auth-protected |
| `/api/sessions` | `sessionRoutes.js` | Requires `requireAuth` |
| `/api/admin` | `adminRoutes.js` | Requires `requireAdmin` |
| `/api/usage` | `usageRoutes.js` | Requires `requireAuth` |
| `/api/dashboard` | `dashboardRoutes.js` | |
| `/api/export` | `exportRoutes.js` | |
| `/api/intelligence` | `intelligenceRoutes.js` | |
| `/api/jobs` | `jobRoutes.js` | |
| `/api/memory` | `memoryRoutes.js` | |
| `/api/planner` | `plannerRoutes.v3_6.js` | |
| `/api/recovery` | `recoveryRoutes.js` | |
| `/api/topic-shift` | `topicAdjacentRoutes.js` | |
| `/api/runtime` | `runtimeRoutes.v5.js` | |

**Health check**: `GET /health` returns `{ ok }` (not under `/api` and auth-gated).

---

## Job Worker (`src/worker.js`)

A standalone process run separately from the HTTP server. Polls the database every **600ms** for eligible jobs.

### Main Loop

```
loop()
  └─ every 30s: runWatchdog()          — marks stale sessions as isVisible=false
  └─ claimNextJob(WORKER_ID)           — optimistic lock via updateMany
  └─ processJob(job)
       └─ runSessionJob(job)
            ├─ Phase 1: Planning
            │   ├─ cycle 0: PLANNER_SYSTEM prompt → 4-7 prompts
            │   └─ cycle N: CYCLE_SYSTEM prompt with prior output context
            └─ Phase 2: Process loop (one AI call per prompt)
                └─ per prompt: publish PROMPT_START → callAI → INSERT AiOutput → publish OUTPUT
  └─ completeJob(job.id) or retry/fail
```

### Shutdown Handling

`SIGTERM` / `SIGINT` set `shuttingDown = true`. If no job is running, the process exits immediately. If a job is in flight, it finishes first, then exits in the `finally` block.

### Retry Policy

Failed jobs with `attempts < maxAttempts` are re-queued with exponential backoff:

```
delay = 2^attempts × 10,000ms
```

Default `maxAttempts` is set in `jobQueueService.enqueueJob`. After all attempts are exhausted the session is marked `failed` and the SSE `status:failed` event is published.

---

## Key Services

### `services/bus.js` — In-Process Pub/Sub

```js
bus.publish(sessionId, eventObject)   // → fan-out to all subscribers
bus.subscribe(sessionId, handler)     // → returns unsubscribe()
bus.cleanup(sessionId)                // → removes the EventEmitter when session ends
```

Internally a `Map<sessionId, EventEmitter>`. The SSE endpoint subscribes on connection and unsubscribes on `req.close`. The worker publishes after every meaningful state change. This is entirely in-memory — if the HTTP server and worker are ever run on separate machines, this bus must be replaced with Redis Pub/Sub.

### `services/aiGovernor.js` — Concurrency Semaphore

Limits the number of simultaneous OpenAI calls.

```
AI_MAX_CONCURRENT  (env, default 1)
AI_CALL_TIMEOUT_MS (env, default 120_000)
```

Usage:
```js
const result = await runGoverned(() => callAIRich({ ... }))
```

Internally keeps an `active` counter and a `waiters` queue. If `active >= max`, the call is queued. Each call also races against a `Promise.race` timeout — if the AI call exceeds `AI_CALL_TIMEOUT_MS` the semaphore slot is released and a `TimeoutError` is thrown.

### `services/openaiClient.js` — OpenAI Wrapper

```js
callAI({ system, user, temperature })      // → string (text only)
callAIRich({ system, user, temperature })  // → { text, usage, model }
```

If `OPENAI_API_KEY` is not set (dev mode), both functions return mock content immediately.

Model is read from `OPENAI_MODEL` env (default: `gpt-4o`).

### `services/usageService.js` — Token Accounting

Every AI call goes through `runAccountedAiCall`:

```js
await runAccountedAiCall({
  userId, sessionId, jobId,
  phase,       // label for the ledger row ("planner", "process_1_0", …)
  prompt,      // for token estimation
  callAi,      // async function that calls callAIRich
})
```

What it does:
1. Creates a `UsageLedger` row with `status: STARTED` and an estimated token count.
2. Checks the user's monthly total against `usageLimits` — throws `UsageLimitError` if over limit.
3. Executes `callAi()`.
4. Updates the ledger row to `SUCCESS` with actual token counts.

**TTL cache**: Monthly usage per user is cached in a `Map<userId, {tokens, ts}>` for **30 seconds** to avoid hitting the database on every prompt.

### `services/jobQueueService.js` — Durable Job Queue

```js
enqueueJob({ userId, sessionId, type, payload, runAt? })  // → Job row
claimNextJob(workerId)   // → Job | null (atomic via updateMany)
completeJob(jobId)
failJob(jobId, error)
```

**Claim logic** — avoids race conditions without a transaction:
```js
prisma.job.updateMany({
  where: { status: 'queued', lockedBy: null, runAt: { lte: now } },
  data:  { status: 'running', lockedBy: workerId, lockedAt: now },
  orderBy: { runAt: 'asc' },
  take: 1,
})
```
Then fetches the row it just claimed by `lockedBy + status`. This is safe because `updateMany` is atomic.

### `services/jobStateService.js` — State Machine

Defines valid session and job status transitions. Call `canTransition(from, to)` before updating status to avoid invalid moves. Throws if the transition is not in the allowed map.

---

## SSE Event Types (`lib/eventTypes.js`)

| Constant | Wire value | When |
|---|---|---|
| `CONNECTED` | `"connected"` | On SSE connection (includes current status) |
| `HEARTBEAT` | `"heartbeat"` | Every 10s keepalive |
| `STATUS` | `"status"` | Session status change |
| `PLAN` | `"plan"` | New plan generated |
| `PROMPT_START` | `"prompt-start"` | Starting an individual prompt |
| `OUTPUT` | `"output"` | Prompt result (HTML) |

The `STATUS` payload includes `{ status, cycle?, nextIn?, pace?, error? }`. `nextIn` is the millisecond delay until the next cycle — the client uses it to drive a countdown timer.

---

## Auth System (`middleware/auth.js`)

JWT stored in an httpOnly cookie (`token`). 30-day expiry.

- `requireAuth` — throws 401 if no valid cookie. Attaches `req.user`.
- `optionalAuth` — same but never throws; `req.user` may be null.
- `requireAdmin` (`middleware/permissions.js`) — `requireAuth` + checks `user.role === 'ADMIN'`.
- `assertOwnsSession(userId, sessionId)` — fetches session from DB, throws 403 if `userId` doesn't match.

---

## Pace System (`lib/pace.js`)

```js
const PACE_MS = { fast: 8_000, steady: 18_000, deep: 35_000 }
paceMs(pace)  // → number of ms
```

The pace delay is applied between cycles. After each cycle completes the worker calls `enqueueJob({ runAt: new Date(Date.now() + delay) })`. The client receives `nextIn` in the STATUS event and counts down.

---

## Input Validation (`lib/validation.js`)

All route handlers validate input before touching the database. The helpers throw an `HttpError` with a 400 status code on failure:

```js
requireString(value, fieldName, { min?, max? })
requireEmail(value, fieldName)
requirePassword(value, fieldName)
requireId(value, fieldName)        // must be a non-empty string
optionalInt(value, fieldName, { min?, max?, fallback? })
optionalArray(value, fieldName)
parseJsonObject(value, fieldName)
```

### Route Wrapper (`lib/route.js`)

```js
router.get('/path', requireAuth, route(async (req, res) => {
  // any thrown error is forwarded to next(err)
}))
```

`route(fn)` is a thin wrapper that calls `fn(req, res).catch(next)` — eliminates the try/catch boilerplate from every handler.

---

## Database Models

Current runtime models used by the worker path:
- `User` — accounts, role (`USER` / `ADMIN`), plan
- `AiSession` — one per run; holds `status`, `pace`, `cycleCount`, `originalPrompt`, `lastHeartbeatAt`, `isVisible`
- `Job` — work queue; `status` is `queued → running → completed | failed | cancelled`
- `AiOutput` — HTML output rows, one per prompt per cycle
- `UsageLedger` — one row per AI call; tracks actual and estimated token counts

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `DATABASE_URL` | — | MySQL connection string |
| `JWT_SECRET` | — | Signs auth cookies |
| `OPENAI_API_KEY` | — | If absent, mock mode is used |
| `OPENAI_MODEL` | `gpt-4o` | Model name |
| `AI_MAX_CONCURRENT` | `1` | Max parallel AI calls |
| `AI_CALL_TIMEOUT_MS` | `120000` | Per-call timeout |
| `MAX_PROMPTS_PER_CYCLE` | `6` | Capped by `usageLimits.hardMaxPlannerTasks` |
| `WORKER_ID` | `worker-main` | Identifies the worker in job lock rows |

---

## Running Locally

```bash
# 1. Install dependencies
cd server && npm install

# 2. Set up your .env (copy from .env.example or set manually):
#    DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, CLIENT_ORIGIN

# 3. Run database migrations
npx prisma migrate dev

# 4. Start the HTTP server (one terminal)
npm run dev

# 5. Start the worker (another terminal)
npm run worker
```

Both processes must be running for sessions to work. The HTTP server alone will accept requests and create jobs, but nothing will process them until the worker is up.

---

## Adding a New Route

1. Create a handler in the appropriate `routes/` file (or a new file).
2. Use the `route()` wrapper for async handlers.
3. Validate all inputs with helpers from `lib/validation.js`.
4. Mount the router in `routes/index.js`.

```js
// routes/widgetRoutes.js
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { route } from '../lib/route.js'
import { requireId } from '../lib/validation.js'

export const widgetRoutes = Router()

widgetRoutes.get('/:id', requireAuth, route(async (req, res) => {
  const id = requireId(req.params.id, 'id')
  // ... fetch from DB
  res.json({ ok: true, widget })
}))
```

---

## Common Pitfalls

**Bus is in-memory.** Events published by the worker are lost if the HTTP server isn't running. They are also lost across server restarts — there is no replay. SSE clients reconnect and receive the current session status from the `CONNECTED` event, but miss any events that fired while disconnected.

**Worker is single-threaded.** `AI_MAX_CONCURRENT=1` means only one AI call runs at a time across the entire process. Raise it carefully — OpenAI rate limits apply per API key.

**`claimNextJob` requires `runAt ≤ now`.** Jobs enqueued with a future `runAt` (e.g. cycle delays) will sit untouched until the clock catches up. This is intentional — it implements the pace delay.

**Usage cache is per-process.** The 30-second TTL cache in `usageService.js` lives in the worker's heap. If you run multiple worker processes, each has an independent cache — limits could be exceeded by up to `AI_MAX_CONCURRENT × processes` calls before the cache refreshes.
