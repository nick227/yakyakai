import { evolveCycle } from '../planning.js'
import { updateSessionCurrentPrompt } from './sessionState.js'
import { shouldEvolve } from './sessionUtils.js'

export async function runEvolutionOrchestration(ctx) {
  if (shouldEvolve(ctx)) {
    const evolved = await evolveCycle(ctx)
    Object.assign(ctx, evolved)
    await updateSessionCurrentPrompt(ctx.sessionId, ctx.currentPrompt)
  } else {
    ctx.cycle = (ctx.cycle ?? 0) + 1
  }
  return ctx
}
