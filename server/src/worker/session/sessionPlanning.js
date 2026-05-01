import { runPlanningPhase, getFastIntro } from '../planning.js'
import { updateSessionFirstCycle, updateSessionRestartCycle, updateSessionPromptCount } from './sessionState.js'
import { emitMetric } from '../../lib/metrics.js'

export async function runPlanningOrchestration(ctx) {
  const cycleNumber = ctx.cycle + 1
  const planningPrompt = ctx.hasRestartContext
    ? ctx.previousPrompt
    : (ctx.currentPrompt || ctx.session.currentPrompt || ctx.session.originalPrompt)

  if (ctx.cycle === 0) {
    const introStartedAt = Date.now()
    getFastIntro({
      session: ctx.session,
      sessionId: ctx.sessionId,
      subject: planningPrompt,
      publish: ctx.publish
    })
      .catch(() => null)
      .finally(() => {
        emitMetric('intro_generation_ms', Date.now() - introStartedAt, {
          sessionId: ctx.sessionId,
          cycle: cycleNumber,
        })
      })
  }

  const plannerStartedAt = Date.now()
  ctx.plannerPromise = runPlanningPhase({
    session: ctx.session,
    sessionId: ctx.sessionId,
    jobId: ctx.jobId,
    cycle: ctx.cycle,
    currentPrompt: planningPrompt,
    previousPrompt: ctx.previousPrompt,
    restartInstruction: ctx.restartInstruction
  })
    .then(async (plan) => {
      if (ctx.cycle === 0) {
        await updateSessionFirstCycle(ctx.sessionId, ctx.session.originalPrompt, plan.steps.length, ctx.session.originalPrompt)
      } else if (ctx.restartInstruction && ctx.previousPrompt) {
        await updateSessionRestartCycle(ctx.sessionId, ctx.restartInstruction, plan.steps.length)
      } else {
        await updateSessionPromptCount(ctx.sessionId, plan.steps.length)
      }
      return plan
    })
    .finally(() => {
      emitMetric('planner_duration_ms', Date.now() - plannerStartedAt, {
        sessionId: ctx.sessionId,
        cycle: cycleNumber,
        phase: ctx.restartInstruction ? 'restart' : (ctx.cycle === 0 ? 'initial' : 'next'),
      })
    })

  ctx.plan = {
    steps: [{ input: planningPrompt }],
  }
  ctx.currentPrompt = planningPrompt
  return ctx
}
