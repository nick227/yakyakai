/**
 * Session Runner - Thin Orchestration Layer
 *
 * This file is the entry point for session job processing in the worker.
 * It coordinates the four phases of a session cycle through abstracted modules:
 * - Planning: media insertion, fast intro, plan generation, state updates
 * - Execution: plan step execution with pause/stop handling
 * - Evolution: next prompt generation for continued exploration
 * - Enqueue: schedule next cycle or complete session
 *
 * All execution details are delegated to modules in ./session/
 */

import { prisma } from '../db/prisma.js'
import { EventTypes } from '../lib/eventTypes.js'
import { buildCycleContext, getSessionStatus } from './session/sessionContext.js'
import { updateSessionStatus } from './session/sessionState.js'
import { runPlanningOrchestration } from './session/sessionPlanning.js'
import { runExecutionPhase } from './session/sessionExecution.js'
import { runEvolutionOrchestration } from './session/sessionEvolution.js'
import { enqueueNextCycle } from './session/sessionEnqueue.js'
import { handleSessionError } from './session/sessionErrorHandler.js'
import { insertCycleMedia } from './session/sessionMedia.js'

const PHASE = {
  PLANNING: 'planning',
  EXECUTION: 'execution',
  EVOLUTION: 'evolution',
  ENQUEUE: 'enqueue'
}

/**
 * Executes a single session cycle through all four phases.
 *
 * @param {Object} ctx - Cycle context object (sealed, contains session, job, phase, etc.)
 * @returns {Object} Updated context after cycle completion
 */
export async function runSessionCycle(ctx) {
  ctx = { ...ctx, cycleStartedAt: Date.now() }

  const cycleNumber = ctx.cycle + 1
  const contentPrompt = ctx.hasRestartContext
    ? ctx.previousPrompt
    : (ctx.currentPrompt || ctx.session.currentPrompt || ctx.session.originalPrompt)

  // ── Pre-planning content sources (fire-and-forget, run concurrently with planning) ──
  if (ctx.cycle === 0) {
    void insertCycleMedia(ctx.sessionId, cycleNumber, contentPrompt, ctx.publish, 'video')
    // Add additional top-of-session third-party sources here
  }

  // Phase 1: Planning
  ctx.phase = PHASE.PLANNING
  ctx = await runPlanningOrchestration(ctx)

  // Phase 2: Execution
  ctx.phase = PHASE.EXECUTION
  ctx = await runExecutionPhase(ctx)

  if (ctx.outputs.paused || ctx.outputs.stopped) return ctx

  // ── Post-execution content sources (awaited, render after AI content) ──
  if (ctx.cycle === 0) {
    await insertCycleMedia(ctx.sessionId, cycleNumber, contentPrompt, ctx.publish, 'image')
    // Add additional bottom-of-session third-party sources here
  }

  // Phase 3: Evolution
  ctx.phase = PHASE.EVOLUTION
  ctx = await runEvolutionOrchestration(ctx)

  // Phase 4: Enqueue
  ctx.phase = PHASE.ENQUEUE
  return enqueueNextCycle(ctx)
}

/**
 * Entry point for session job processing.
 *
 * Validates session, builds context, runs cycle, handles errors.
 *
 * @param {Object} job - Job from queue (contains sessionId, payloadJson)
 * @param {Object} publish - SSE publish callback function
 */
export async function runSessionJob(job, { publish }) {
  const { sessionId } = job
  if (!sessionId) throw new Error('Job missing sessionId')

  // Fetch and validate session
  const session = await prisma.aiSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error(`AiSession ${sessionId} not found`)
  if (session.status === 'cancelled') {
    return
  }

  const isFirstCycle = session.cycleCount === 0
  const cycle = session.cycleCount ?? 0
  const cycleNumber = cycle + 1

  // Clean up restart payload if present (single-use)
  if (job.payloadJson) {
    await prisma.job.update({
      where: { id: job.id },
      data: { payloadJson: JSON.stringify({}) }
    }).catch(() => {})
  }

  // Set session to running and publish status
  await updateSessionStatus(sessionId, 'running')
  await publish(sessionId, EventTypes.STATUS, { status: isFirstCycle ? 'planning' : 'expanding', cycle: cycleNumber })

  // Build sealed cycle context with all necessary data
  const cycleCtx = buildCycleContext(session, job, publish)

  // Run cycle with centralized error handling
  try {
    await runSessionCycle(cycleCtx)
  } catch (error) {
    await handleSessionError(error, cycleCtx, publish, cycleNumber)
  }
}
