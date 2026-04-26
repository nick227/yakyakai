import sanitize from 'sanitize-html'

export function chunkItems(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export function stripHtml(html) {
  return sanitize(String(html || ''), {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: (text) => text.replace(/\s+/g, ' ').trim()
  })
}

export function buildCyclePlannerContext(outputs) {
  return outputs
    .slice()
    .reverse()
    .map((o) => `Cycle ${o.cycle}, item ${o.index + 1}: ${stripHtml(o.html).slice(0, 420)}`)
    .join('\n\n')
}

export function buildProcessPriorContext(priorHtml) {
  return priorHtml
    .slice(-3)
    .map((h) => stripHtml(h).slice(0, 500))
    .join('\n')
}
