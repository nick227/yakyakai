let active = 0
const MAX_CONCURRENT = Number(process.env.AI_MAX_CONCURRENT || 1)
const waiters = []

export async function runGoverned(task) {
  if (active >= MAX_CONCURRENT) {
    await new Promise((resolve) => waiters.push(resolve))
  }

  active++

  try {
    const timeout = Number(process.env.AI_TIMEOUT_MS || 60000)
    return await Promise.race([
      task(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('AI_TIMEOUT')), timeout)),
    ])
  } finally {
    active--
    waiters.shift()?.()
  }
}

export function getGovernorState() {
  return {
    active,
    max: MAX_CONCURRENT,
    available: Math.max(0, MAX_CONCURRENT - active),
  }
}
