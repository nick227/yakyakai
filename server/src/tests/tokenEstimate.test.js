import assert from 'node:assert/strict'
import { estimateTokens, countPrompt } from '../utils/tokenEstimate.js'

assert.equal(estimateTokens(''), 0)
assert.ok(estimateTokens('hello world') >= 2)

const counted = countPrompt('hello world')
assert.equal(counted.promptChars, 11)
assert.ok(counted.estimatedPromptTokens >= 2)

console.log('tokenEstimate tests passed')
