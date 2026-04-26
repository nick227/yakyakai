export class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message || code)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function badRequest(code = 'BAD_REQUEST', message = 'Bad request', details = null) {
  return new HttpError(400, code, message, details)
}

export function unauthorized(code = 'AUTH_REQUIRED', message = 'Please log in to continue.') {
  return new HttpError(401, code, message)
}

export function forbidden(code = 'FORBIDDEN', message = 'You do not have permission to perform this action.') {
  return new HttpError(403, code, message)
}

export function notFound(code = 'NOT_FOUND', message = 'Resource not found.') {
  return new HttpError(404, code, message)
}

export function conflict(code = 'CONFLICT', message = 'Request conflicts with current state.', details = null) {
  return new HttpError(409, code, message, details)
}

export function paymentRequired(code = 'LIMIT_REACHED', message = 'Usage limit reached.') {
  return new HttpError(402, code, message)
}

export function contentTooLarge(code = 'CONTENT_TOO_LARGE', message = 'Content exceeds size limit.') {
  return new HttpError(413, code, message)
}
