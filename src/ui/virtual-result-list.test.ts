import { describe, expect, it } from 'vitest'
import { typicalRowSize } from './virtual-result-list.js'

describe('typicalRowSize', () => {
  it('takes the height most measured rows share once enough agree', () => {
    expect(typicalRowSize([61, 61, 61, 61, 61, 140, undefined], null)).toBe(61)
  })

  it('keeps the previous estimate until enough rows agree', () => {
    expect(typicalRowSize([61, 61, 61, 140], null)).toBeNull()
    expect(typicalRowSize([61, 61, 72, 140], 58)).toBe(58)
  })

  it('ignores unmeasured and empty rows', () => {
    expect(typicalRowSize([0, 0, 0, 0, 0, undefined], 64)).toBe(64)
  })
})
