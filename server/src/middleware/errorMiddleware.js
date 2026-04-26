import { HttpError } from '../lib/httpError.js'
import { logger } from '../lib/logger.js'

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`))
}

export function errorHandler(error, req, res, _next) {
  const status = Number(error.status || 500)
  const isPublic = status < 500

  if (status >= 500) {
    logger.error('Unhandled request error', {
      method: req.method,
      path: req.originalUrl,
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    })
  }

  res.status(status).json({
    ok: false,
    error: error.code || (isPublic ? 'REQUEST_FAILED' : 'SERVER_ERROR'),
    message: isPublic ? error.message : 'Unexpected server error.',
    details: isPublic ? error.details || null : null,
  })
}
