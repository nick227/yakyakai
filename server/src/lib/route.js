export function route(handler) {
  return async function wrappedRoute(req, res, next) {
    try {
      await handler(req, res, next)
    } catch (error) {
      next(error)
    }
  }
}

export function ok(res, data = {}) {
  res.json({ ok: true, ...data })
}
