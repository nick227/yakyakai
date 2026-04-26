import assert from 'node:assert/strict'
import { requireEmail, requireId, optionalInt } from '../lib/validation.js'
import { canTransition } from '../services/jobStateService.js'

assert.equal(requireEmail('Test@Example.com'), 'test@example.com')
assert.equal(requireId('abc_123-XYZ'), 'abc_123-XYZ')
assert.equal(optionalInt(undefined, 'take', { fallback: 50 }), 50)

assert.equal(canTransition('queued', 'running'), true)
assert.equal(canTransition('complete', 'queued'), false)
assert.equal(canTransition('cancelled', 'running'), false)

console.log('v4 hardening tests passed')
