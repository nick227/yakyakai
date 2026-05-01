## Latency Tuning Proposal (Fast-First MVP)

### Goal

Speed up perceived and actual response times in session generation without reducing output quality.

### Decision

For MVP, commit fully to `fast` behavior. Do not tune `steady` in this phase.

### Phase 1 proposed changes (MVP)

Apply these runtime configuration and pacing updates:

- `AI_MAX_CONCURRENT=2`
- `DEFAULT_PACE=fast`
- For `fast` pace (locked values):
  - `planStepDelay.js` -> `fast: 0`
  - `pace.js` -> `fast: 4000`

Ignore `steady` delay tuning for now to avoid mixed behavior and unclear attribution.

### Why this should work

- The current runtime is heavily serialized by design, so latency compounds across planner + step execution + cycle gaps.
- These changes remove intentional waiting and allow limited concurrency while keeping prompts, planner logic, and model selection unchanged.
- Because generation instructions are unchanged, quality risk is low compared to model/prompt rewrites.

### Expected impact (realistic)

For a typical cycle with multiple plan steps:

- **TTFR improvement (noticeable):** faster first visible streamed content.
- **First usable content improvement (noticeable):** less waiting between queued/running and visible output.
- **Cycle completion improvement (moderate):** still limited by serial per-step execution.
- **System throughput improvement (significant):** better multi-user performance from global concurrency increase.
- **Single-session speed improvement (limited to moderate):** per-session steps remain serial.

### Quality and risk assessment

Risk level: **low to medium** (mainly operational, not content quality).

Primary risks:

- Burst-shape amplification from removing delays and adding concurrency.
- Spike throttling and uneven latency (not only hard failures).
- Higher short-burst DB pressure due to more frequent cycle activity.
- Potentially denser output cadence in UI (expected behavior change).

Simple mitigation for burst smoothing (optional in MVP, recommended in phase 2):

- Add soft jitter before slot acquisition only when there is active pressure:
  - apply jitter only if `active >= 1`
  - e.g. `await sleep(random(20-80ms))`

Operational guardrail:

- Add hard per-step timeout (`max_step_duration_ms`) in the `30_000-45_000` range.
- On timeout: abort current step and continue cycle to avoid slot starvation.

Quality risk is limited because:

- No change to planner schema.
- No change to prompt strategy.
- No change to model or temperature defaults in this proposal.

### Rollout plan

1. Deploy phase 1 configuration changes:
   - `AI_MAX_CONCURRENT=2`
   - `DEFAULT_PACE=fast`
2. Deploy phase 1 code constants update for `fast`:
   - fast step delay: `0`
   - fast cycle delay: `4_000`
3. Add phase 1 instrumentation:
   - `time_to_first_step_start_ms`
   - `ai_queue_wait_ms`
   - `ai_active_count`
   - `runAccountedAiCall_duration_ms`
4. Add phase 1 resilience guardrail:
   - `max_step_duration_ms` timeout with step abort + cycle continue behavior
5. Monitor for 24-48 hours.
6. Phase 2 (only if stable):
   - Increase `AI_MAX_CONCURRENT=3`
   - Add `20-80ms` jitter before plan-slot acquisition
7. Phase 3 (next real latency unlock):
   - Parallel step execution within a session (2-at-a-time) with strict ordered publish.
8. Keep rollback ready by reverting env values and constants if instability appears.

### Success metrics

Track before/after p50 and p95:

- **TTFR**: time to first SSE chunk with visible content.
- **Time to first step start**: time from job start to first plan-step execution start.
- Time to first non-heartbeat SSE payload.
- Time to first `OUTPUT` event.
- Time to complete one cycle.
- Outputs per minute per active session.
- User pause/stop/abandon rate during first cycle.
- `runAccountedAiCall` timing:
  - total duration per call
  - share of cycle wall-time spent inside accounting path
- Concurrency pressure:
  - `ai_queue_wait_ms`
  - `ai_active_count / AI_MAX_CONCURRENT`
- Error rates:
  - AI timeout
  - provider/rate-limit failures
  - throttling spikes / latency variance under burst
  - failed session jobs

### Acceptance criteria

- TTFR reduction of at least `30-50%` (p50 and p95).
- Cycle time reduction of at least `20%` (p95).
- Time-to-first-output reduction with no regression in output quality sampling.
- Error-rate delta less than `+2%` vs baseline.
- No significant increase in failed sessions.
- No measurable quality regression in manual sampling.
- Positive user sentiment on speed in support feedback.

### Notes

- This is intentionally a first move: removes artificial waits and reduces global blocking.
- This does not remove per-session serialization; steps still run `step1 -> step2 -> step3`.
- If phase 1 is successful but speed is still insufficient, parallel step execution is the next major unlock.
- Fast mode will increase content density per minute. This can feel much better for speed, but may feel overwhelming for some users; treat this as a UX pacing signal, not a runtime bug.
