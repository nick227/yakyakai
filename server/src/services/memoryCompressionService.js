import { prisma } from '../db/prisma.js'
import { estimateTokens } from '../utils/tokenEstimate.js'

const MAX_TOTAL_CHARS = 500_000

export function compressMessagesLocally(messages=[]) {
  let budget = MAX_TOTAL_CHARS
  const parts = []
  for (let i = 0; i < messages.length && budget > 0; i++) {
    const m = messages[i]
    const role = m.agent || m.role || `item_${i+1}`
    const text = String(m.text || m.html || '').replace(/<[^>]+>/g, ' ').slice(0, Math.min(1500, budget))
    budget -= text.length
    parts.push(`${role}: ${text}`)
  }
  const joined = parts.join('\n\n')

  const sentences = joined
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  const summary = sentences.slice(0, 12).join(' ').slice(0, 3000)

  const facts = sentences
    .filter(s => /is|are|must|should|needs|requires|uses|has/i.test(s))
    .slice(0, 12)

  const decisions = sentences
    .filter(s => /decided|recommend|best|priority|avoid|use|choose/i.test(s))
    .slice(0, 8)

  const openLoops = sentences
    .filter(s => /todo|next|needs|unclear|risk|question|later/i.test(s))
    .slice(0, 8)

  return {
    summary,
    facts,
    decisions,
    openLoops,
    sourceCount: messages.length,
    tokenEstimate: estimateTokens(summary),
  }
}

export async function saveCompressedMemory({ sessionId, messages }) {
  const compressed = compressMessagesLocally(messages)

  return prisma.sessionMemory.create({
    data: {
      sessionId,
      summary: compressed.summary,
      factsJson: JSON.stringify(compressed.facts),
      decisionsJson: JSON.stringify(compressed.decisions),
      openLoopsJson: JSON.stringify(compressed.openLoops),
      sourceCount: compressed.sourceCount,
      tokenEstimate: compressed.tokenEstimate,
    }
  })
}

export async function getLatestMemory(sessionId) {
  return prisma.sessionMemory.findFirst({
    where: { sessionId },
    orderBy: { createdAt:'desc' }
  })
}
