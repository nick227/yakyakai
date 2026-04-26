import { Download } from 'lucide-react'

export default function ExportActions({ title='Yakyakai Export', sessionId, messages=[] }) {
  function downloadMarkdown() {
    const body = toMarkdown({ title, sessionId, messages })
    const blob = new Blob([body], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="export-actions">
      <button
        className="icon-button"
        type="button"
        onClick={downloadMarkdown}
        disabled={!messages.length}
        title="Export Markdown"
        aria-label="Export conversation as Markdown"
      >
        <Download size={15} />
      </button>
    </div>
  )
}

function toMarkdown({ title, sessionId, messages }) {
  const lines = [`# ${title}`, '']
  if (sessionId) lines.push(`Session: ${sessionId}`, '')

  messages.forEach((message, index) => {
    const role = normalizeRole(message.role || message.agent || 'message')
    lines.push(`## ${index + 1}. ${role}`, '')
    lines.push(stripHtml(message.content || message.html || message.text || '').trim() || '_No content_', '')
  })

  return `${lines.join('\n')}\n`
}

function normalizeRole(role) {
  return String(role).toLowerCase().replace(/^\w/, (char) => char.toUpperCase())
}

function stripHtml(value) {
  const doc = new DOMParser().parseFromString(String(value), 'text/html')
  return doc.body.textContent || ''
}
