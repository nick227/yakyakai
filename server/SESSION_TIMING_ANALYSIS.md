# Session Timing and Flow Analysis

This document explains how timing works in a user chat session, how serial backpressure is enforced, and when generated process outputs are saved.

## Key Answers

- Planner prompts are generated first as one ordered plan array per cycle.
- Process prompts are executed strictly one-at-a-time (serial backpressure).
- After each prompt completes, output is persisted and then streamed immediately.
- A control checkpoint runs between prompts (`paused` / `cancelled`) before any next AI request.
- Process outputs are saved to DB **before** the output event is published to the client.

## End-to-End Runtime Flow

1. Worker loop claims `session.cycle` job.
2. Session runner sets session status to `running`.
3. Session runner publishes status (`planning` on first cycle, `expanding` on later cycles).
4. Planner call runs once and returns an array of prompts.
5. Plan event is published to client.
6. Processing phase starts (serial loop):
   - re-read session state before each prompt
   - if `cancelled`, stop immediately
   - if `paused`, stop immediately
   - publish `PROMPT_START` for current prompt
   - execute one AI process call
   - persist output (`aiOutput`, then `chatMessage`)
   - publish `OUTPUT` event
   - append job event
   - re-read session state checkpoint before moving to next prompt
7. After processing:
   - if cancelled/stopped -> publish `stopped`, cleanup
   - else if max cycles reached -> mark `completed`, publish completed
   - else compute delay by pace, update `nextEligibleAt`
   - if paused -> publish paused and do not enqueue next cycle
   - otherwise publish cycling and enqueue next cycle

## Timing Behavior During Processing

## 1) Planner vs Process

- Planner is one blocking call per cycle.
- Processing then executes prompts one-at-a-time in strict order.

## 2) Are prompts used serially?

Yes. Prompt execution is fully serial:

- order is `P0 -> P1 -> P2 ...`
- only one paid process request is in flight at any moment
- no later prompt starts before prior prompt is persisted and emitted

## 3) Pause/Stop Spend Protection

Protection is prompt-granular:

- checkpoint before each AI request prevents launching the next paid call when paused/cancelled
- checkpoint after each output keeps the loop responsive right after stream emission
- worst-case waste is limited to the single in-flight prompt that was already started

## 4) Exact DB Write Timing for Process Outputs

For each completed prompt result:

1. insert into `aiOutput` (`sessionId`, `cycle`, `index`, `html`)
2. insert into `chatMessage` (`role=ASSISTANT`, `content=html`, metadata with cycle/index)
3. publish `OUTPUT` event to client
4. append job event

Implication: DB persistence currently happens **before** client output event publish.

## Event Timeline Example (Serial Backpressure)

Assume cycle prompts: `P0..P5`:

1. plan complete -> publish PLAN
2. checkpoint session state
3. `P0`:
   - publish `PROMPT_START`
   - call AI
   - save DB rows
   - publish `OUTPUT`
   - checkpoint session state
4. `P1` repeats same pattern
5. continue until prompt list ends or checkpoint sees `paused`/`cancelled`
6. cycle transition status (`paused`/`stopped`/`cycling`/`completed`)

## Operational Notes

- `pace` affects cycle-to-cycle delay and word limit in process prompts.
- serial processing gives predictable spend control and simpler debugging.
