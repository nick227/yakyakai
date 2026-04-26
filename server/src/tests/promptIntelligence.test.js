import assert from 'node:assert/strict'
import { analyzePromptShape } from '../services/promptIntelligenceService.js'
import { decideNextRunAction, scoreOutput } from '../services/adaptiveRunService.js'

const analysis = analyzePromptShape('Build a React dashboard with token usage, saved runs, and billing limits.')
assert.equal(analysis.category, 'coding')
assert.ok(analysis.qualityScore > 40)

assert.ok(scoreOutput('') < 50)
assert.equal(decideNextRunAction({ currentIndex: 9, totalPrompts: 10, maxPrompts: 10 }).action, 'stop')

console.log('v3.5 intelligence tests passed')
