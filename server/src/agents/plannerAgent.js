export function normalizePlan(raw, count) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(stripFences(raw)) : raw
    const prompts = Array.isArray(parsed?.prompts) ? parsed.prompts : []
    return {
      title: 'Exploration Plan',
      prompts: prompts
        .map((p, i) => {
          const prompt = typeof p === 'string' ? p.trim() : String(p?.prompt || '').trim()
          return { prompt }
        })
        .filter((p) => p.prompt)
        .slice(0, count),
    }
  } catch {
    return {
      title: 'Fallback Exploration Plan',
      prompts: Array.from({ length: count }).map((_, i) => ({
        prompt: `Explore dimension ${i + 1}: ${String(raw || '').slice(0, 400)}`,
      })),
    }
  }
}

function stripFences(text) {
  return String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}
