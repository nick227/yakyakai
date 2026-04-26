import assert from 'node:assert/strict'
import {
  detectUsedZones,
  recommendAdjacentZones
} from '../services/topicAdjacentShifterService.js'

const prompts = [
  'Homepage copy for roofer',
  'Google ads campaign',
  'Pricing tiers',
  'Review trust badges'
]

const used = detectUsedZones(prompts)
assert.ok(used.includes('marketing'))
assert.ok(used.includes('pricing'))

const next = recommendAdjacentZones(prompts)
assert.ok(next.length > 0)

console.log('topic adjacent shifter tests passed')
