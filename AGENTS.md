# Repository Guidelines

## Project Structure & Module Organization

Full-stack monorepo: `client/` (React 19 + Vite) and `server/` (Express + Prisma + MySQL).

**Critical:** the server runs as two separate processes that share the database but no in-memory state:
- `server/src/index.js` — Express API + in-process SSE bus (`services/bus.js`, one EventEmitter per session)
- `server/src/worker.js` — Background job worker; polls MySQL job queue every 600ms, claims jobs atomically

Do not merge these into one process. The SSE bus is server-only; the worker has no SSE access.

**Server `src/` layout:**
- `worker/` — session orchestration: `sessionRunner.js`, `planning.js`, `prompts.js`, `constants.js`
- `ai/` — plan execution: `planLimiter.js` (concurrency governor), `planRuntime.js`, `planExecutor.js`
- `agents/` — `plannerAgent.js` (`normalizePlan`) converts raw LLM output into step arrays
- `services/` — `bus.js` (SSE), `jobQueueService.js`, `usageService.js`, `sessionAbortService.js`
- `routes/` — one file per resource; each route uses `lib/route.js` wrapper for consistent error handling

**Client `src/` layout:**
- `hooks/useAppController.js` — all SSE event handling and session lifecycle state
- `components/ChatStream.jsx` — message rendering; `RunComposer.jsx` — prompt input + pace controls
- `styles/` — custom CSS token system (`tokens.css`, `layout.css`, `components.css`). Tailwind v4 is installed for layout utilities only; never use Tailwind classes for component-level styling.

## Build, Test, and Development Commands

```bash
# Install (from repo root)
npm run install:all

# Full dev stack (API server + worker + client hot-reload)
npm run dev

# Production
npm run start:prod

# Database
npm run db:migrate      # create migration (dev)
npm run db:deploy       # apply migrations (prod)
```

```bash
# Tests (server only — Vitest + Supertest)
cd server
npm run test            # watch mode
npm run test:run        # single run (CI)
npm run test:coverage   # coverage → server/coverage/

# Single test file
npx vitest run src/tests/api/auth.test.js

# Client lint
cd client && npm run lint
```

## Coding Style & Naming Conventions

- **No TypeScript** — plain ES modules (`"type": "module"`) throughout; Node 22.x required
- **ESLint** (client only): flat config ESLint 9 with `eslint-plugin-react`, `eslint-plugin-react-hooks`, `react-refresh`; `prop-types` and `react-in-jsx-scope` disabled
- **No formatter config** — match the surrounding style; no Prettier
- CSS custom properties (`--token-name`) are the styling primitive; component styles belong in `client/src/styles/`, not inline or in Tailwind classes

## Testing Guidelines

Server-side only: `server/src/tests/api/`. Vitest + Supertest for HTTP assertions. `setup.js` handles database cleanup between tests. No client-side tests exist.

## Key Friction Points

### Server

**Job claiming is a two-step find + updateMany, not a single atomic query.** `claimNextJob` does `findFirst` then `updateMany`; if `claimed.count === 0` a race was lost — return `null` and let the poll loop retry. Never collapse into a single `upsert`.

**The SSE bus lives only in the API server process.** The worker receives `publish` as an injected callback. Importing `bus` directly from the worker would create a separate `EventEmitter` instance with no subscribers — events would be silently dropped.

**`sessionAbortService` holds one `AbortController` per session.** `beginSessionAiCall` overwrites any existing controller without aborting it first. Always call `endSessionAiCall` when the AI call finishes (the `finally` block in `planning.js`), or the old signal is orphaned and a stop/pause won't cancel the in-flight request.

**`planLimiter` is a module-level global, not per-session.** `active` and `waiters` are shared across every concurrent session in the process. `AI_MAX_CONCURRENT` defaults to `1`. A second import resolves to the same module instance — there is only one semaphore.

**`session.cycleCount` is snapshotted once at job start.** All local arithmetic uses `session.cycleCount + 1`. If the job crashes before the end-of-cycle DB write, the counter stays unchanged and the retry re-enters the same cycle number. This is intentional idempotency, not a bug.

**`isVisible` gates job claiming.** `claimNextJob` skips jobs whose session has `isVisible = false`. Any new job type that attaches a `sessionId` must ensure the session is visible or it will never be claimed.

### Client

**SSE reconnect is one-shot.** `useSession` retries exactly once (`reconnectAttempts >= 1` → fatal error). Server-side event replay via `lastEventIdRef` is what makes that one retry safe — don't remove the `Last-Event-ID` header from `api.eventsUrl`.

**Tab visibility uses `sendBeacon`, not `fetch`.** `visibilitychange` and `pagehide` call `navigator.sendBeacon` because the browser can cancel in-flight `fetch` during page unload. The 15-second polling heartbeat uses `fetch`. Do not swap them.

**Output list is a 80-entry sliding window.** `MAX_VISIBLE_OUTPUTS` in `useOutputs.js` drops the oldest entry when the cap is reached. DB records are unlimited; this is render-only and intentional for memory.

**`cancelled` is normalized to `stopped` everywhere in the client.** `normalizeSessionStatus` maps `cancelled` → `stopped`. Never check for `cancelled` in client code — it will never appear in UI state.

**The sub-hooks are not independently usable.** `useSession`, `useMessages`, and `useOutputs` have cross-dependencies: `handleSSEEvent` from `useOutputs` mutates `setChatMessages` owned by `useMessages`. Always compose them through `useAppController`.

## Commit Guidelines

Lowercase imperative phrases, no period, no scope prefix:

```
update railway.json
add worker start build
update routes and css
```
