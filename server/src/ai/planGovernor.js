let active = 0
const MAX_CONCURRENT = Number(process.env.AI_MAX_CONCURRENT || 1)
const waiters = []

export async function acquirePlanSlot() {
  if (active >= MAX_CONCURRENT) {
    await new Promise((resolve) => waiters.push(resolve))
  }
  active++
}

export function releasePlanSlot() {
  active--
  const next = waiters.shift()
  if (next) next()
}

export async function runPlanTask(task) {
  await acquirePlanSlot()
  let timer
  try {
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 60000)
    return await Promise.race([
      task(),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error('AI_TIMEOUT')), timeoutMs)
      }),
    ])
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
