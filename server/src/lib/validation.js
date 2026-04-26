import { badRequest } from './httpError.js'

export function requireString(value, field, {
  min = 1,
  max = 20_000,
  trim = true,
} = {}) {
  const text = trim ? String(value ?? '').trim() : String(value ?? '')

  if (text.length < min) {
    throw badRequest('VALIDATION_ERROR', `${field} is required.`, { field, min })
  }

  if (text.length > max) {
    throw badRequest('VALIDATION_ERROR', `${field} is too long.`, { field, max })
  }

  return text
}

export function optionalString(value, field, {
  max = 20_000,
  trim = true,
  fallback = '',
} = {}) {
  if (value === undefined || value === null) return fallback
  return requireString(value, field, { min: 0, max, trim })
}

export function requireEmail(value, field = 'email') {
  const email = requireString(value, field, { min: 3, max: 320 }).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw badRequest('INVALID_EMAIL', 'Enter a valid email address.', { field })
  }
  return email
}

export function requirePassword(value, field = 'password') {
  const password = String(value ?? '')
  if (password.length < 8) {
    throw badRequest('WEAK_PASSWORD', 'Password must be at least 8 characters.', { field })
  }
  if (password.length > 256) {
    throw badRequest('PASSWORD_TOO_LONG', 'Password is too long.', { field })
  }
  return password
}

export function requireId(value, field = 'id') {
  const id = requireString(value, field, { min: 8, max: 128 })
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw badRequest('INVALID_ID', `${field} is invalid.`, { field })
  }
  return id
}

export function optionalInt(value, field, {
  min = 0,
  max = 10_000,
  fallback = 0,
} = {}) {
  if (value === undefined || value === null || value === '') return fallback

  const num = Number(value)
  if (!Number.isInteger(num) || num < min || num > max) {
    throw badRequest('INVALID_NUMBER', `${field} must be an integer between ${min} and ${max}.`, { field, min, max })
  }

  return num
}

export function optionalArray(value, field, {
  max = 100,
  fallback = [],
} = {}) {
  if (value === undefined || value === null) return fallback
  if (!Array.isArray(value)) {
    throw badRequest('INVALID_ARRAY', `${field} must be an array.`, { field })
  }
  if (value.length > max) {
    throw badRequest('ARRAY_TOO_LARGE', `${field} has too many items.`, { field, max })
  }
  return value
}

export function parseJsonObject(value, field = 'json') {
  if (value && typeof value === 'object') return value
  try {
    return JSON.parse(String(value || '{}'))
  } catch {
    throw badRequest('INVALID_JSON', `${field} must be valid JSON.`, { field })
  }
}
