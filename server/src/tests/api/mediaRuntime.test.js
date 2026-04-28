import { describe, it, expect } from 'vitest'
import { shouldInsertMediaForCycle } from '../../media/insertMediaForCycle.js'

describe('media runtime cycle gating', () => {
  it('inserts giphy only on even cycles', () => {
    expect(shouldInsertMediaForCycle({ cycle: 1, kind: 'giphy' })).toBe(false)
    expect(shouldInsertMediaForCycle({ cycle: 2, kind: 'giphy' })).toBe(true)
    expect(shouldInsertMediaForCycle({ cycle: 3, kind: 'giphy' })).toBe(false)
    expect(shouldInsertMediaForCycle({ cycle: 4, kind: 'giphy' })).toBe(true)
  })

  it('does not gate image/video cycles', () => {
    expect(shouldInsertMediaForCycle({ cycle: 1, kind: 'image' })).toBe(true)
    expect(shouldInsertMediaForCycle({ cycle: 1, kind: 'video' })).toBe(true)
    expect(shouldInsertMediaForCycle({ cycle: 3, kind: 'image' })).toBe(true)
    expect(shouldInsertMediaForCycle({ cycle: 3, kind: 'video' })).toBe(true)
  })
})
