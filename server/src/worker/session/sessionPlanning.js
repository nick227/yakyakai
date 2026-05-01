import { runPlanningPhase, getFastIntro } from '../planning.js'
import { insertCycleMedia } from './sessionMedia.js'
import { updateSessionFirstCycle, updateSessionRestartCycle, updateSessionPromptCount } from './sessionState.js'

export async function runPlanningOrchestration(ctx) {
  const cycleNumber = ctx.cycle + 1
  const planningPrompt = ctx.hasRestartContext
    ? ctx.previousPrompt
    : (ctx.currentPrompt || ctx.session.currentPrompt || ctx.session.originalPrompt)

  if (ctx.cycle === 0) {
    await getFastIntro({
      session: ctx.session,
      sessionId: ctx.sessionId,
      subject: planningPrompt,
      publish: ctx.publish
    }).catch(() => {})

    await insertCycleMedia(ctx.sessionId, cycleNumber, planningPrompt, ctx.publish, 'video')
  }

  const plan = await runPlanningPhase({
    session: ctx.session,
    sessionId: ctx.sessionId,
    jobId: ctx.jobId,
    cycle: ctx.cycle,
    currentPrompt: planningPrompt,
    previousPrompt: ctx.previousPrompt,
    restartInstruction: ctx.restartInstruction
  })

  if (ctx.cycle === 0) {
    await updateSessionFirstCycle(ctx.sessionId, ctx.session.originalPrompt, plan.steps.length, ctx.session.originalPrompt)
  } else if (ctx.restartInstruction && ctx.previousPrompt) {
    await updateSessionRestartCycle(ctx.sessionId, ctx.restartInstruction, plan.steps.length)
  } else {
    await updateSessionPromptCount(ctx.sessionId, plan.steps.length)
  }

  ctx.plan = plan
  ctx.currentPrompt = planningPrompt
  return ctx
}
