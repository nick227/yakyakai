let active = 0
const MAX_CONCURRENT = Number(process.env.AI_MAX_CONCURRENT || 2)
const waiters = []
const JITTER_MIN_MS = 20
const JITTER_MAX_MS = 80

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function acquirePlanSlot() {
  const waitStartedAt = Date.now()
  const activeBefore = active

  // Smooth bursts only when there is active pressure.
  if (activeBefore >= 1) {
    const jitterMs = JITTER_MIN_MS + Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1))
    await sleep(jitterMs)
  }

  if (active >= MAX_CONCURRENT) {
    await new Promise((resolve) => waiters.push(resolve))
  }

  const queueWaitMs = Date.now() - waitStartedAt
  active++
  return {
    aiQueueWaitMs: queueWaitMs,
    aiActiveCount: active,
    aiMaxConcurrent: MAX_CONCURRENT,
  }
}

export function releasePlanSlot() {
  active--
  const next = waiters.shift()
  if (next) next()
}

export async function runPlanTask(task) {
  const slotMetrics = await acquirePlanSlot()
  let timer
  try {
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 60000)
    const result = await Promise.race([
      task(),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error('AI_TIMEOUT')), timeoutMs)
      }),
    ])
    return { result, slotMetrics }
  } finally {
    if (timer) clearTimeout(timer)
    releasePlanSlot()
  }
}

export function getPlanCapacity() {
  return {
    active,
    max: MAX_CONCURRENT,
    available: Math.max(0, MAX_CONCURRENT - active),
  }
}
