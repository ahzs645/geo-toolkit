import { describe, expect, it } from 'vitest'
import { geometricBreaks, naturalBreaks, NATURAL_BREAKS_MAX_VALUES, standardDeviationBreaks } from './classBreaks.js'
import { resolvePaletteScale } from './paletteScale.js'

const sorted = (values: number[]) => [...values].sort((a, b) => a - b)

describe('class breaks', () => {
  it('finds the gaps between clusters, where equal intervals split a cluster', () => {
    const values = sorted([1, 2, 2, 3, 20, 21, 22, 23, 90, 91, 95])
    expect(naturalBreaks(values, 3)).toEqual([20, 90])
    // Fewer distinct values than classes: one class a value.
    expect(naturalBreaks([4, 4, 9, 9], 5)).toEqual([9])
    expect(naturalBreaks([7, 7, 7], 4)).toEqual([])
    expect(naturalBreaks(values, 1)).toEqual([])
  })

  it('weights a value by how often it occurs', () => {
    // 60 fives against one outlier each side: the middle class is the fives.
    const values = sorted([1, ...Array<number>(60).fill(5), 6, 30])
    const [low, high] = naturalBreaks(values, 3)
    expect(low).toBe(5)
    expect(high).toBe(30)
  })

  it('thins a large sample and still returns ascending boundaries inside the range', () => {
    const values = sorted(Array.from({ length: NATURAL_BREAKS_MAX_VALUES * 3 }, (_, i) => (i * 7919) % 1000))
    const breaks = naturalBreaks(values, 6)
    expect(breaks).toHaveLength(5)
    expect(breaks.every((value, i) => value > 0 && value < 999 && (i === 0 || value > breaks[i - 1]))).toBe(true)
  })

  it('centres standard deviation classes on the mean and drops boundaries past the data', () => {
    const values = sorted([10, 20, 30, 40, 50, 60, 70, 80, 90])
    const mean = 50
    const sd = Math.sqrt(values.reduce((total, v) => total + (v - mean) ** 2, 0) / values.length)
    expect(standardDeviationBreaks(values, 4)).toEqual([mean - sd, mean, mean + sd])
    expect(standardDeviationBreaks(values, 3)).toEqual([mean - sd / 2, mean + sd / 2])
    // Six classes would put boundaries two deviations out, past the data: only four survive.
    expect(standardDeviationBreaks(values, 6)).toHaveLength(3)
    expect(standardDeviationBreaks([5, 5, 5], 4)).toEqual([])
  })

  it('multiplies by a constant ratio, and refuses a range that reaches zero', () => {
    const breaks = geometricBreaks([1, 10, 100, 1000, 10000], 4)!
    expect(breaks.map((value) => Math.round(value))).toEqual([10, 100, 1000])
    expect(geometricBreaks([0, 5, 50], 3)).toBeNull()
    expect(geometricBreaks([-4, 5, 50], 3)).toBeNull()
  })

  it('classifies through the palette scale, falling back to equal intervals where a scheme cannot apply', () => {
    const values = [1, 2, 2, 3, 20, 21, 22, 23, 90, 91, 95]
    const options = {
      colors: ['#ffffff', '#000000'],
      domain: [1, 95] as const,
      classes: 3,
      values,
      missingColor: '#cccccc',
    }
    const natural = resolvePaletteScale({ ...options, classification: 'natural-breaks' })
    expect(natural.breaks).toEqual([20, 90])
    expect(natural.colors).toHaveLength(3)
    expect(natural.indexForValue(20)).toBe(1)
    expect(resolvePaletteScale({ ...options, classification: 'standard-deviation' }).breaks.length).toBeGreaterThan(0)
    const zero = { ...options, domain: [0, 95] as const, values: [0, ...values] }
    expect(resolvePaletteScale({ ...zero, classification: 'geometric-interval' }).breaks).toEqual(
      resolvePaletteScale({ ...zero, classification: 'equal-interval' }).breaks,
    )
    expect(() => resolvePaletteScale({ ...options, values: [], classification: 'natural-breaks' })).toThrow(
      'need numeric observations',
    )
  })
})
