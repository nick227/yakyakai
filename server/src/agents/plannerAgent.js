export function normalizePlan(raw, count) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(stripFences(raw)) : raw
    const rawList = Array.isArray(parsed?.prompts) ? parsed.prompts : []
    return {
      steps: rawList
        .map((p) => {
          const input =
            typeof p === 'string'
              ? p.trim()
              : String(p?.prompt ?? p?.input ?? '').trim()
          return { input }
        })
        .filter((s) => s.input)
        .slice(0, count),
    }
  } catch {
    return {
      steps: Array.from({ length: count }).map((_, i) => ({
        input: `Explore dimension ${i + 1}: ${String(raw || '').slice(0, 400)}`,
      })),
    }
  }
}

function stripFences(text) {
  return String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}
