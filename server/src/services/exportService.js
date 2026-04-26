import { prisma } from '../db/prisma.js'

const MAX_TOTAL_CHARS = 2_000_000

export function toMarkdown({ title='Yakyakai Export', messages=[] }) {
  let budget = MAX_TOTAL_CHARS
  const parts = []
  for (let i = 0; i < messages.length && budget > 0; i++) {
    const m = messages[i]
    const heading = m.agent || m.role || `Output ${i+1}`
    const content = String(m.text || m.html || '').replace(/<br\s*\/?/gi, '\n').replace(/<[^>]+>/g, '').slice(0, budget)
    budget -= content.length
    parts.push(`## ${heading}\n\n${content}`)
  }
  const body = parts.join('\n\n---\n\n')

  return `# ${title}\n\n${body}\n`
}

export function toJsonExport(payload) {
  return JSON.stringify(payload, null, 2)
}

export async function saveOutput({ userId=null, sessionId=null, title, body, format='markdown' }) {
  return prisma.savedOutput.create({
    data: { userId, sessionId, title, body, format }
  })
}
