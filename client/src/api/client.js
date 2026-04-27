import { PACE } from '../lib/uiConstants.js'

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
  start:     (prompt, pace = PACE.STEADY, clientId = null) => post('/api/sessions/start', { prompt, pace, clientId }),
  heartbeat: (id, visible = true)      => post(`/api/sessions/${id}/heartbeat`, { visible }),
  pause:     (id)                      => post(`/api/sessions/${id}/pause`),
  resume:    (id)                      => post(`/api/sessions/${id}/resume`),
  stop:      (id)                      => post(`/api/sessions/${id}/stop`),
  eventsUrl: (id, afterEventId = null) => {
    const params = new URLSearchParams()
    if (afterEventId) params.set('afterEventId', afterEventId)
    const query = params.toString()
    return `/api/sessions/${id}/events${query ? `?${query}` : ''}`
  },
  messages:  (id, before = null, limit = null) => {
    const params = new URLSearchParams()
    if (before) params.set('before', before)
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return get(`/api/sessions/${id}/messages${query ? `?${query}` : ''}`)
  },
  getSession: (id)                     => get(`/api/sessions/${id}`),
  listSessions:    (take = 20, cursor = null) => {
    const params = new URLSearchParams()
    params.set('take', String(take))
    if (cursor) params.set('cursor', cursor)
    return get(`/api/sessions?${params.toString()}`)
  },
  renameSession:   (id, title)          => request(`/api/sessions/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ title }) }),
  deleteSession:   (id)                 => request(`/api/sessions/${id}`, { method: 'DELETE' }),
  getCredits:      ()          => get('/api/credits'),
  purchaseCredits: (packId)    => post('/api/credits/purchase', { packId }),
}
