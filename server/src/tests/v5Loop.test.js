import assert from 'node:assert/strict'
import { createInitialBatch } from '../services/plannerV5Service.js'
assert.equal(createInitialBatch('x').length,5)
console.log('v5 ok')
