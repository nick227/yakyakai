const jsonHeaders = { 'Content-Type': 'application/json' }

async function request(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Request failed')
    err.status = res.status
    err.code = data.error
    throw err
  }
  return data
}

export function get(path) {
  return request(path)
}

export function post(path, body = {}) {
  return request(path, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
}

export const api = {
  start:     (prompt, pace = 'steady') => post('/api/sessions/start', { prompt, pace }),
  heartbeat: (id, visible = true)      => post(`/api/sessions/${id}/heartbeat`, { visible }),
  pause:     (id)                      => post(`/api/sessions/${id}/pause`),
  resume:    (id)                      => post(`/api/sessions/${id}/resume`),
  stop:      (id)                      => post(`/api/sessions/${id}/stop`),
  eventsUrl: (id)                      => `/api/sessions/${id}/events`,
  messages:  (id, before = null, limit = null) => {
    const params = new URLSearchParams()
    if (before) params.set('before', before)
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return get(`/api/sessions/${id}/messages${query ? `?${query}` : ''}`)
  },
  getSession: (id)                     => get(`/api/sessions/${id}`),
}
