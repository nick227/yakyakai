# YakyakAI

A full-stack AI session runner that turns a single prompt into a continuous, self-evolving stream of connected exploration. Each session plans a set of distinct work prompts, processes them one by one, then automatically plans the next cycle based on what was found — indefinitely, until the user stops it.

![screenshot](https://i.postimg.cc/YC64vncX/screenshot.png)

---

## What it does

You enter a goal. The planner agent expands it into 4–7 focused work prompts, each targeting a different leverage area (build, conversion, pricing, retention, trust, etc.). A process agent runs those prompts sequentially through a protected server-side queue, streaming each output to the client as it completes. When the cycle finishes, an evolution planner reads the prior outputs and plans the next cycle — going deeper, finding adjacent angles, surfacing connections the user didn't ask for. The stream runs at the user's chosen pace (Fast / Steady / Deep) until they stop it.

**The product thesis:** a planner that generates commercially useful, distinct deliverables — not summaries, not overviews — is worth more than the model itself. A good session should make a user think *"that's actually useful."*

---

## Architecture

```
client (React + Vite)
  │  POST /api/sessions/start        → create session + enqueue job
  │  GET  /api/sessions/:id/events   → SSE stream (real-time outputs)
  │  POST /api/sessions/:id/heartbeat → tab visibility signal
  │  POST /api/sessions/:id/pause|resume|stop
  │
server (Express)
  │  Auth middleware (JWT, HTTP-only cookie)
  │  Usage accounting (per-call ledger, monthly limits)
  │  In-process SSE bus (EventEmitter per session)
  │  REST API + error handling
  │
worker (Node.js, separate process)
  │  Polls MySQL-backed job queue every 600ms
  │  Claims jobs atomically (no double-processing)
  │  Skips sessions where tab is hidden (isVisible=false)
  │  Watchdog: expires stale sessions after 45s no heartbeat
  │  Retries transient failures with exponential backoff (2^n × 10s)
  │  Graceful shutdown on SIGTERM/SIGINT
  │
MySQL (via Prisma)
     Users, AiSessions, AiOutputs, Jobs, JobEvents,
     UsageLedger, SessionMemory, SavedOutputs, ...
```

### Session lifecycle

```
Start → queued → planning → running (outputs stream) → cycling (pace delay)
     → expanding (next cycle plan) → running → cycling → ...
     → paused (user or tab hidden) → resumed → running → ...
     → stopped (user) or expired (no heartbeat 45s)
```

### How infinite cycling works

After every cycle completes, the worker:
1. Reads the last 8 outputs for context
2. Calls the evolution planner (`CYCLE_SYSTEM`) — which is instructed to go deeper, avoid repeating topics, and find adjacent territory
3. Enqueues the next `session.cycle` job with `runAt = now + paceMs`
4. The worker claims it only after the delay and only if `session.isVisible = true`

Hidden hard cap: 1,000 cycles. Never surfaced in the UI.

### Tab lifecycle

The client sends a heartbeat every 15 seconds via `fetch`. On `visibilitychange` or `pagehide`, it sends an immediate `sendBeacon` with `{ visible: false }`. The server marks `isVisible = false`, and the worker's job query filters these sessions out. The server-side watchdog also sweeps every 30 seconds, expiring any session with a heartbeat older than 45 seconds. When the user returns to the tab, the heartbeat resumes, `isVisible` flips back to `true`, and the stream continues.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 20+, Express 4, cookie-parser, cors |
| ORM | Prisma 6, MySQL |
| Auth | JWT (jsonwebtoken), bcryptjs, HTTP-only cookies |
| AI | OpenAI SDK (`gpt-4.1-mini` default) |
| Queue | MySQL-backed job table, atomic `updateMany` claim |
| Real-time | Server-Sent Events, Node EventEmitter bus |
| Client | React 18, Vite, DOMPurify, Lucide icons |
| Validation | Zod (request bodies), custom helpers for IDs/strings |
| Rate limiting | express-rate-limit (auth endpoints: 20 req / 15 min) |

---

## Quick start

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/yakyakai"
JWT_SECRET="generate-a-long-random-string"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4.1-mini"
PORT=3001
CLIENT_ORIGIN="http://localhost:5173"
```

If `OPENAI_API_KEY` is not set, the app falls back to deterministic mock responses — the full flow runs, you just get fake content.

### 3. Apply database migrations

```bash
cd server && npx prisma migrate deploy
```

### 4. Start everything

**Terminal 1 — API server:**
```bash
cd server && npm run dev
```

**Terminal 2 — Background worker:**
```bash
cd server && npm run worker:dev
```

**Terminal 3 — Client:**
```bash
cd client && npm run dev
```

Open `http://localhost:5173` — register an account, then start a session.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | Prisma MySQL connection string, for example `mysql://root:@127.0.0.1:3306/yakyakai` |
| `JWT_SECRET` | — | Required. Secret for signing auth tokens. |
| `OPENAI_API_KEY` | — | OpenAI key. Omit to use mock responses. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Model used for all AI calls. |
| `PORT` | `3001` | Server port. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allowed origin. |
| `MAX_PROMPTS_PER_CYCLE` | `6` | Prompts generated per plan (capped at `HARD_MAX_PLANNER_TASKS`). |
| `HARD_MAX_PLANNER_TASKS` | `7` | Absolute maximum prompts per cycle. |
| `FREE_MONTHLY_PROMPT_LIMIT` | `100` | Monthly prompt cap per user. |
| `FREE_MONTHLY_TOKEN_LIMIT` | `100000` | Monthly token cap per user. |
| `HARD_MAX_PROMPT_CHARS` | `24000` | Maximum characters in a single user prompt. |
| `WORKER_ID` | `worker-main` | Worker identifier shown in logs and job events. |

---

## API routes

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/register` | Create account. Returns user + sets auth cookie. |
| `POST` | `/login` | Sign in. Returns user + sets auth cookie. |
| `POST` | `/logout` | Clear auth cookie. |
| `GET` | `/me` | Return current user. |

### Sessions — `/api/sessions`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/start` | ✓ | Create session. Body: `{ prompt, pace? }`. |
| `GET` | `/:id` | ✓ | Get session record. |
| `GET` | `/:id/events` | ✓ | SSE stream. Emits `connected`, `status`, `plan`, `prompt-start`, `output`, `heartbeat`. |
| `POST` | `/:id/heartbeat` | ✓ | Update tab visibility. Body: `{ visible: true\|false }`. |
| `POST` | `/:id/pause` | ✓ | Pause session. Cancels pending queued jobs. |
| `POST` | `/:id/resume` | ✓ | Resume session. Enqueues new cycle job. |
| `POST` | `/:id/stop` | ✓ | Stop session permanently. |

### Usage — `/api/usage`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/me` | ✓ | Current user's monthly token and prompt usage. |

### Admin — `/api/admin`

Requires `ADMIN` role.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/online` | Live snapshot: active sessions, per-session tokens, monthly usage per user, hourly/daily totals. Refreshes every 5s in the UI. |
| `GET` | `/queue` | Job queue status counts + AI governor state. |
| `GET` | `/jobs` | Recent jobs list. |
| `POST` | `/sessions/:id/stop` | Force-stop any session (bypasses ownership check). |

### SSE event types

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ sessionId, status }` | Sent immediately on SSE connect. |
| `status` | `{ status, cycle?, nextIn?, pace? }` | Session state change. `nextIn` (ms) present on `cycling`. |
| `plan` | `{ title, prompts[], cycle }` | New cycle plan ready. |
| `prompt-start` | `{ index, title, valueStatement, connectionNote, cycle }` | About to process a prompt. |
| `output` | `{ index, title, html, cycle }` | Completed prompt output (sanitized HTML). |
| `heartbeat` | `{ ts }` | Keep-alive from server every 10s. |

---

## Planner design

The planner is the core of the product. Each prompt must:

- Target a **different leverage area**: build, conversion, pricing, marketing, trust, operations, retention, research, automation, risk
- Produce a **concrete deliverable** (a draft, a framework, a script, a pricing model — not an overview)
- Be **under 80 words**
- **Never paraphrase** the user's goal

Banned prompt types: brainstorm, overview, explain topic, list benefits, introduction.

**Sequence rule:** prompt 1 = highest-leverage action on the core request. Prompts 2+ = adjacent areas the user needs but did not name. Final prompt = furthest strategic reach.

**Cycle evolution rule:** subsequent cycles read the last 8 outputs and must go deeper into unresolved questions or cover genuinely new territory. At least 2 prompts per cycle must cover areas not yet touched.

---

## Pace settings

| Name | Delay between outputs |
|------|-----------------------|
| Fast | 8 seconds |
| Steady | 18 seconds *(default)* |
| Deep | 35 seconds |

Selected at session start. Shown in the status line. Cannot be changed mid-session.

---

## Admin setup

### Promote a user to ADMIN

```bash
cd server
node --input-type=module -e "
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
await p.user.update({ where: { email: 'your@email.com' }, data: { role: 'ADMIN' } })
console.log('Done.')
await p.\$disconnect()
"
```

### Admin panel

Once promoted, an **Admin** button appears in the top-right of the UI. The panel shows:

- **Active now** — count of sessions currently visible in a browser tab
- **Tokens / hr** — rolling 1-hour aggregate across all users
- **Tokens today** — since midnight local time
- **AI calls today** — total ledger entries today

Per-session table shows: user email, current status, cycle number, pace, tokens used this session, monthly token total, monthly call count, last heartbeat timestamp.

**Force stop** button terminates any session immediately, cancels pending jobs, and pushes a stop event to the user's browser over SSE.

Auto-refreshes every 5 seconds.

---

## Worker notes

Run the worker as a **separate process** from the API server. They share the same database but no in-memory state (except the in-process SSE bus, which is server-only).

```bash
# Production
node src/worker.js

# Development (auto-restart)
npm run worker:dev
```

The worker handles graceful shutdown on `SIGTERM` and `SIGINT`: it sets a `shuttingDown` flag, finishes the current job if one is running, then exits cleanly.

Job retry uses exponential backoff: `2^attempts × 10s`. After `maxAttempts` (default 3), the session is marked `failed` and the user's SSE connection receives a `status: failed` event.

---

## Project structure

```
yakyakai.com/
├── server/
│   ├── prisma/
│   │   └── schema.prisma          # Full data model
│   └── src/
│       ├── agents/                # plannerAgent (normalizePlan)
│       ├── config/                # usageLimits
│       ├── db/                    # Prisma singleton
│       ├── lib/                   # httpError, eventTypes, pace, route, validation
│       ├── middleware/             # auth (JWT), permissions (requireAdmin)
│       ├── routes/                # authRoutes, sessionRoutes, adminRoutes, ...
│       ├── services/              # bus, jobQueueService, usageService, aiGovernor
│       ├── utils/                 # monthWindow, tokenEstimate
│       ├── index.js               # Express server entry
│       └── worker.js              # Background job worker
└── client/
    └── src/
        ├── api/                   # client.js (V2), authApi.js
        ├── lib/                   # eventTypes.js (shared constants)
        └── main.jsx               # Full app: AuthGate, App, AdminView
```

---

## Testing

### API Tests

The server uses Vitest + Supertest for API testing.

**Run API tests:**
```bash
cd server
npm run test
```

**Run tests once (CI mode):**
```bash
cd server
npm run test:run
```

**Generate coverage report:**
```bash
cd server
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

### API Documentation

Interactive API documentation is available via Swagger UI:

**Start the server:**
```bash
cd server
npm run dev
```

**Visit:** `http://localhost:3001/api-docs`

The Swagger UI provides:
- Interactive API exploration
- Request/response schemas
- Authentication requirements
- Try-it-out functionality

### Test Structure

```
server/src/tests/
├── api/
│   ├── auth.test.js      # Authentication endpoint tests
│   └── sessions.test.js  # Session CRUD endpoint tests
└── setup.js              # Database cleanup utilities
```

### Current Coverage

- **Authentication:** Register, login, logout, Google OAuth
- **Sessions:** Create, list, get, rename, delete
- **Total tests:** 18 passing
- **Coverage:** ~34% routes, expanding to critical paths

See `docs/TESTING_COVERAGE.md` for detailed coverage analysis and implementation roadmap.

