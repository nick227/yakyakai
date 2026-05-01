import request from 'supertest'
import app from '../index.js'
import { prisma } from '../db/prisma.js'
import { processJob } from '../worker/jobProcessor.js'
import { publish } from '../worker/events.js'

function parsePayload(event) {
  try {
    return JSON.parse(event.payload)
  } catch {
    return null
  }
}

function hasVisibleContent(parsed) {
  if (!parsed?.payload) return false
  if (parsed.type === 'output') return Boolean(String(parsed.payload.html || '').trim())
  if (parsed.type === 'fast-intro') return Boolean(String(parsed.payload.intro || '').trim())
  if (parsed.type === 'notice') return Boolean(String(parsed.payload.message || '').trim())
  return false
}

async function main() {
  const stamp = Date.now()
  const email = `sanity-${stamp}@example.com`
  const password = 'password123'

  await request(app)
    .post('/api/auth/register')
    .send({ email, password, name: 'Sanity User' })

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password })

  const authCookie = loginRes.headers['set-cookie']
  if (!authCookie) throw new Error('No auth cookie from login')

  const startAt = Date.now()
  const startRes = await request(app)
    .post('/api/sessions/start')
    .set('Cookie', authCookie)
    .send({ prompt: 'Quick sanity check: startup latency metrics', pace: 'fast' })

  if (startRes.status !== 201) {
    throw new Error(`Session start failed: ${startRes.status} ${JSON.stringify(startRes.body)}`)
  }

  const { sessionId, jobId } = startRes.body
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('Queued job not found')

  await processJob(job, { publish, workerId: 'sanity-check' })

  const events = await prisma.aiSessionEvent.findMany({
    where: { sessionId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const parsedEvents = events.map((event) => parsePayload(event)).filter(Boolean)
  const firstPromptStart = parsedEvents.find((event) => event.type === 'prompt-start')
  const firstVisible = parsedEvents.find((event) => hasVisibleContent(event))
  const stepOutputs = parsedEvents.filter((event) =>
    event.type === 'output' && Number.isInteger(event.payload?.index) && event.payload.index >= 0
  )
  const lastStepOutput = stepOutputs.length > 0 ? stepOutputs[stepOutputs.length - 1] : null

  const timeToFirstStepStartMs = firstPromptStart?.ts ? firstPromptStart.ts - startAt : null
  const firstVisibleSseMs = firstVisible?.ts ? firstVisible.ts - startAt : null
  const cycleDurationMs = firstPromptStart?.ts && lastStepOutput?.ts
    ? lastStepOutput.ts - firstPromptStart.ts
    : null
  const expectedStepCount = Number(process.env.FIXED_STEP_COUNT || 0) || null
  const timeoutLikely = expectedStepCount != null ? stepOutputs.length < expectedStepCount : null

  console.log(JSON.stringify({
    type: 'sanity-check-summary',
    sessionId,
    jobId,
    stepParallelism: Number(process.env.STEP_PARALLELISM || 2),
    timeToFirstStepStartMs,
    firstVisibleSseMs,
    cycleDurationMs,
    stepOutputsCount: stepOutputs.length,
    expectedStepCount,
    timeoutLikely,
    hasPromptStart: Boolean(firstPromptStart),
    hasVisibleEvent: Boolean(firstVisible),
  }))
}

main()
  .catch((error) => {
    console.error('[sanity-check] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

