# Worker Process (Short Overview)

This document explains how the current worker pipeline runs jobs.

## 1) Entrypoint

`src/worker.js` is now a thin bootstrap:

- loads env
- registers shutdown signals
- starts the worker loop (`startLoop`)
- exits cleanly when shutdown is requested and no active job remains

## 2) Main Loop

`src/worker/loop.js` runs continuously:

1. runs watchdog on interval
2. claims next queued job
3. processes that job
4. marks complete only when processing fully succeeds
5. waits briefly when no job is available

## 3) Job Processing

`src/worker/jobProcessor.js` handles one job:

- adds lifecycle job events (`started`, `retry`, `failed`)
- routes supported job types to session execution
- applies retry with exponential backoff
- marks session failed + publishes failure status on permanent failure

## 4) Session Execution

`src/worker/sessionRunner.js` is the session state machine:

1. set session status to `running`
2. publish planning/expanding status
3. build plan (initial or cycle planner)
4. publish plan event
5. process prompts in batches
6. update cycle status (`paused`, `cycling`, `completed`, `stopped`)
7. enqueue next cycle job when needed

## 5) Planning + Processing

- `src/worker/planning.js`
  - planner AI calls
  - tool-call schema enforcement (`prompts` required)
  - plan normalization

- `src/worker/processing.js`
  - prompt execution with `PROCESS_CONCURRENCY`
  - per-prompt events (`PROMPT_START`, `OUTPUT`)
  - output/message persistence

## 6) Shared Modules

- `src/worker/events.js`: DB-backed event publishing
- `src/worker/watchdog.js`: stale session visibility cleanup with overlap guard
- `src/worker/context.js`: text/context helper utilities
- `src/worker/constants.js`: prompts, schema, and worker constants
