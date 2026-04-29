import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/prisma.js', () => ({
  prisma: {
    aiSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    job: {
      update: vi.fn(),
    },
  },
}))

vi.mock('../../services/jobEventService.js', () => ({
  addJobEvent: vi.fn(),
}))

vi.mock('../../services/jobQueueService.js', () => ({
  enqueueJob: vi.fn(),
}))

vi.mock('../../services/bus.js', () => ({
  bus: { cleanup: vi.fn() },
}))

vi.mock('../../lib/pace.js', () => ({
  paceMs: vi.fn(() => 1000),
}))

vi.mock('../../services/sessionAbortService.js', () => ({
  isAbortError: vi.fn(() => false),
}))

vi.mock('../../worker/constants.js', () => ({
  MAX_CYCLES: 10,
}))

vi.mock('../../worker/planning.js', () => ({
  buildInitialPlan: vi.fn(),
  buildCyclePlan: vi.fn(),
  buildRestartPlan: vi.fn(),
  getNextPrompt: vi.fn(),
}))

vi.mock('../../ai/planRuntime.js', () => ({
  runPlanCycle: vi.fn(),
}))

vi.mock('../../media/insertMediaForCycle.js', () => ({
  insertMediaForCycle: vi.fn(),
}))

import { prisma } from '../../db/prisma.js'
import { enqueueJob } from '../../services/jobQueueService.js'
import { runPlanCycle } from '../../ai/planRuntime.js'
import { buildCyclePlan, buildRestartPlan, getNextPrompt } from '../../worker/planning.js'
import { runSessionJob } from '../../worker/sessionRunner.js'

describe('session runner restart isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses restart context once and enqueues next cycle without restart payload', async () => {
    prisma.aiSession.findUnique
      .mockResolvedValueOnce({
        id: 'session-1',
        userId: 'user-1',
        status: 'paused',
        cycleCount: 1,
        pace: 'steady',
        currentPrompt: 'previous focus',
        originalPrompt: 'original',
        title: 'Existing title',
      })
      .mockResolvedValueOnce({ status: 'running' })

    prisma.aiSession.update.mockResolvedValue({})
    prisma.job.update.mockResolvedValue({})
    buildRestartPlan.mockResolvedValue({ steps: [{ input: 'step 1' }] })
    runPlanCycle.mockResolvedValue({})

    await runSessionJob(
      {
        id: 'job-1',
        sessionId: 'session-1',
        payloadJson: JSON.stringify({
          restartPrompt: 'make it more funny',
          restartSourcePrompt: 'previous focus',
        }),
      },
      { publish: vi.fn() }
    )

    expect(buildRestartPlan).toHaveBeenCalledTimes(1)
    expect(getNextPrompt).not.toHaveBeenCalled()
    expect(buildCyclePlan).not.toHaveBeenCalled()
    expect(prisma.aiSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({ currentPrompt: 'make it more funny' }),
      })
    )
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        type: 'session.cycle',
        payload: {},
      })
    )
  })
})
