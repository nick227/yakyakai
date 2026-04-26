# AI Agent Flow (Server Chat Session)

This document explains how prompts are generated and executed for the current chat session flow under `server/src`.

## Scope

This is the active production path used by the client:

- `POST /api/sessions/start` (`server/src/routes/sessionRoutes.js`)
- Background processing in `server/src/worker.js`
- AI calls through `server/src/services/openaiClient.js`
- Event streaming through `GET /api/sessions/:sessionId/events`

This repository now uses a single session execution path: `AiSession` + `Job` + worker processing.

## Key Scripts

- `server/src/routes/sessionRoutes.js`
  - Creates `AiSession`
  - Enqueues first job (`session.start`)
  - Serves SSE events and heartbeat/pause/resume/stop endpoints
- `server/src/services/jobQueueService.js`
  - Durable queue operations (`enqueueJob`, `claimNextJob`, `completeJob`, `failJob`)
- `server/src/worker.js`
  - Main orchestration loop
  - Planner and process prompt execution
  - Cycle scheduling and retry handling
- `server/src/agents/plannerAgent.js`
  - `normalizePlan(...)` for planner output normalization
- `server/src/services/openaiClient.js`
  - `callAIRich(...)` OpenAI invocation (`chat.completions.create`)
- `server/src/services/usageService.js`
  - Usage limits, ledger tracking, per-call accounting
- `server/src/services/aiGovernor.js`
  - AI concurrency gate and timeout wrapper
- `server/src/lib/pace.js`
  - Pace delay (`fast`, `steady`, `deep`)
- `server/src/lib/eventTypes.js`
  - Shared event names (`status`, `plan`, `prompt-start`, `output`, etc.)

## End-to-End Order of Operations

1. Client starts session
   - `client/src/api/client.js` calls `POST /api/sessions/start` with `{ prompt, pace }`.
2. Session record created
   - `sessionRoutes.js` inserts `AiSession` with:
     - `originalPrompt`
     - `status: "queued"`
     - `pace`
     - initial user chat message (`ChatMessage` role `USER`)
3. First job enqueued
   - `enqueueJob(...)` creates a `Job` row (`type: "session.start"`).
4. Worker claims job
   - `worker.js` loop calls `claimNextJob(...)` every cycle.
   - Claim only happens for `status: "queued"` and `runAt <= now`.
5. Planner phase runs
   - Worker sets session status to running/planning state.
   - For cycle 1:
     - Uses `PLANNER_SYSTEM` prompt in `worker.js`.
     - Calls `runGoverned(() => runAccountedAiCall(() => callPlannerStructured(...)))`.
   - `normalizePlan(...)` normalizes planner output into prompt items.
6. Plan event emitted
   - Worker publishes `plan` event (`title`, `prompts`, `cycle`).
   - Event stored in `AiSessionEvent`; SSE endpoint polls and forwards to client.
7. Prompt process loop runs sequentially
   - For each planned prompt:
     - Publish `prompt-start`.
     - Build process input including:
       - prompt text
       - prior context summary from recent generated HTML
       - pace-derived word limit
     - AI call via `PROCESS_SYSTEM` through governed/accounted pipeline.
     - Save output in `AiOutput` and `ChatMessage` (`ASSISTANT`).
     - Publish `output`.
8. End-of-cycle scheduling
   - If not stopped/cancelled/paused:
     - Compute delay via `paceMs(...)`.
     - Update `cycleCount` and `nextEligibleAt`.
     - Publish `status: cycling` with `nextIn`.
     - Enqueue next `session.cycle` job with future `runAt`.
9. Next cycle plan generation
   - On `session.cycle`, worker uses `CYCLE_SYSTEM` and recent outputs to plan adjacent/deeper prompts.
   - Steps 6-8 repeat until stop/cancel/failure/max cycle cap.

## Prompt Generation Details

### Initial Planner Prompt

- Defined inline in `worker.js` as `PLANNER_SYSTEM`.
- User message template includes:
  - original goal
  - exact prompt count requirement (`PROMPT_COUNT`)
  - constraints (distinct areas, adjacent needs, no restating goal)

### Cycle Planner Prompt

- Defined as `CYCLE_SYSTEM` in `worker.js`.
- Injects recent cycle output summaries.
- Requires deeper and adjacent new work, avoiding repeated topics.

### Process Prompt

- Defined as `PROCESS_SYSTEM` in `worker.js`.
- Produces HTML fragment output for renderable cards.
- Word cap depends on pace.

### OpenAI Execution

- `openaiClient.callAIRich(...)` sends:
  - `model` from `OPENAI_MODEL` (default `gpt-4.1-mini`)
  - `messages: [{ role: "system" }, { role: "user" }]`
  - `temperature`
- Returns:
  - `text` (assistant content)
  - `usage` (token metadata if provided)
  - `model`

- `openaiClient.callPlannerStructured(...)` sends:
  - `model`, `messages`, `temperature`
  - OpenAI tool/function schema (`submit_plan`) for structured prompt output
- Returns:
  - `prompts` (array of prompt strings)
  - `usage`
  - `model`

## Timing and Runtime Behavior

### Worker Loop Timing

- Job poll idle sleep: `600ms` (`worker.js`)
- Watchdog sweep interval: every `30s`
- Stale visibility threshold: `120s` since last heartbeat

### Client/Session Timing

- Client heartbeat cadence: every `15s` (`client/src/App.jsx`)
- SSE poll interval in events route: every `500ms` (`sessionRoutes.js`)
- SSE keepalive heartbeat when no events: emitted on each empty poll

### Pace Delays (Between Cycles)

- `fast`: `8,000ms`
- `steady`: `18,000ms`
- `deep`: `35,000ms`

Defined in `server/src/lib/pace.js`, applied as `runAt = now + delay`.

### AI Governance and Timeouts

- Max concurrent AI calls: `AI_MAX_CONCURRENT` (default `1`)
- Per-call timeout: `AI_TIMEOUT_MS` (default `60,000ms`)

Both enforced in `server/src/services/aiGovernor.js`.

### Retry Backoff

- On job failure with attempts remaining:
  - `delayMs = 2^attempts * 10,000`
  - Job re-queued with future `runAt`
- After max attempts:
  - session marked failed
  - failure status event emitted

## State and Event Flow

Common event sequence for a healthy cycle:

1. `connected` (on SSE connect)
2. `status` (`planning` or `expanding`)
3. `plan`
4. `prompt-start` (per prompt)
5. `output` (per prompt)
6. `status` (`cycling` with `nextIn`)
7. repeat for next cycle

Terminal outcomes:

- `status: paused`
- `status: stopped`
- `status: completed`
- `status: failed`

## Debug Starting Points

When debugging current behavior, start with:

- `sessionRoutes.js`
- `worker.js`
- `jobQueueService.js`
- `openaiClient.js`
