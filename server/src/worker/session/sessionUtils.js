export function titleFromPrompt(prompt) {
  const text = String(prompt || '').trim().replace(/\s+/g, ' ')
  if (!text) return 'Untitled session'
  return text.length > 60 ? text.slice(0, 60).replace(/\s+\S*$/, '…') : text
}

export function shouldEvolve(ctx) {
  return !ctx.restartInstruction && ctx.cycle > 0
}

export function safePublish(publish, ...args) {
  return publish?.(...args).catch(() => {})
}
