/**
 * Simple adaptive run decisions.
 * Keeps V3.5 smart without building a complex graph engine yet.
 */

export function scoreOutput(output='') {
  const text = String(output || '').trim()
  let score = 50

  if (text.length > 600) score += 10
  if (/steps|recommend|because|tradeoff|risk|next/i.test(text)) score += 10
  if (/I don't know|cannot|unclear|insufficient/i.test(text)) score -= 15
  if (text.length < 160) score -= 20

  return Math.max(0, Math.min(100, score))
}

export function decideNextRunAction({
  currentIndex=0,
  totalPrompts=0,
  recentScores=[],
  maxPrompts=10,
}) {
  const completed = currentIndex + 1
  const remaining = Math.max(0, totalPrompts - completed)
  const avgRecent = recentScores.length
    ? recentScores.reduce((a,b)=>a+b,0) / recentScores.length
    : 70

  if (completed >= maxPrompts) {
    return { action:'stop', reason:'max_prompts_reached' }
  }

  if (remaining <= 0) {
    return { action:'summarize_then_stop', reason:'planned_prompts_complete' }
  }

  if (completed >= 4 && avgRecent < 38) {
    return { action:'modify_plan', reason:'low_recent_quality' }
  }

  if (completed >= 6 && avgRecent < 52) {
    return { action:'compress_and_continue', reason:'diminishing_returns' }
  }

  return { action:'continue', reason:'quality_acceptable' }
}
