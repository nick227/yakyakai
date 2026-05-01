import { addJobEvent } from '../../services/jobEventService.js'
import { runPlanCycle } from '../../ai/planRuntime.js'
import { EventTypes } from '../../lib/eventTypes.js'
import { getSessionStatus } from './sessionContext.js'
import { bus } from '../../services/bus.js'

export async function runExecutionPhase(ctx) {
  const cycleNumber = ctx.cycle + 1
  await ctx.publish(ctx.sessionId, EventTypes.PLAN, { steps: ctx.plan.steps.map((s) => s.input), cycle: cycleNumber })
  await addJobEvent(ctx.job.id, 'planned', `Cycle ${cycleNumber}: ${ctx.plan.steps.length} steps`)

  const outputs = await runPlanCycle({
    session: ctx.session,
    sessionId: ctx.sessionId,
    job: ctx.job,
    currentCycle: cycleNumber,
    plan: ctx.plan,
    publish: ctx.publish,
    addJobEvent,
    getSessionStatus,
  })

  ctx.outputs = outputs

  if (ctx.outputs.paused) {
    const s = await getSessionStatus(ctx.sessionId)
    const pauseStatus = s?.status === 'paused_idle' ? 'paused_idle' : 'paused'
    await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: pauseStatus, cycle: cycleNumber })
    return ctx
  }
  if (ctx.outputs.stopped) {
    await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: 'stopped' })
    bus.cleanup(ctx.sessionId)
    return ctx
  }

  return ctx
}
