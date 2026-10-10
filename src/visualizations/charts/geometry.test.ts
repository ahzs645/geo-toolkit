import { describe, expect, it } from 'vitest'
import { numericExtent, plotBounds, rangeIndices } from './geometry.js'

describe('chart coordinates and ranges', () => {
  it('preserves negative and zero values while excluding missing/nonfinite evidence', () => {
    expect(numericExtent([null, undefined, NaN, Infinity, -Infinity, 0, -8, 12])).toEqual([-8, 12])
    expect(numericExtent([0, null, 0])).toEqual([-0.5, 0.5])
    expect(numericExtent([null, NaN], [-10, 10])).toEqual([-10, 10])
  })
  it('uses host insets for embedded charts and always leaves a drawable area', () => {
    expect(plotBounds(400, 300, 0, { left: 80, right: 20, top: 10, bottom: 50 })).toEqual({
      left: 80,
      top: 10,
      width: 300,
      height: 240,
    })
    expect(plotBounds(0, 0).width).toBe(1)
  })
  it('clamps a navigator to sorted observations when a linked range has no matching endpoints', () => {
    expect(rangeIndices([0, 4, 10], null)).toEqual([0, 2])
    expect(rangeIndices([0, 4, 10], [2, 8])).toEqual([1, 1])
    expect(rangeIndices([0, 4, 10], [20, 30])).toEqual([2, 2])
    expect(rangeIndices([0, 4, 10], [-20, -10])).toEqual([0, 0])
    expect(rangeIndices([], [1, 2])).toEqual([0, 0])
  })
})
