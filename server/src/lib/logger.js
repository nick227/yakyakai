function safeMeta(meta = {}) {
  const copy = { ...meta }
  for (const key of Object.keys(copy)) {
    if (/password|token|secret|cookie|authorization/i.test(key)) {
      copy[key] = '[redacted]'
    }
  }
  return copy
}

export const logger = {
  info(message, meta = {}) {
    console.log(JSON.stringify({ level: 'info', message, ...safeMeta(meta), time: new Date().toISOString() }))
  },
  warn(message, meta = {}) {
    console.warn(JSON.stringify({ level: 'warn', message, ...safeMeta(meta), time: new Date().toISOString() }))
  },
  error(message, meta = {}) {
    console.error(JSON.stringify({ level: 'error', message, ...safeMeta(meta), time: new Date().toISOString() }))
  },
}
