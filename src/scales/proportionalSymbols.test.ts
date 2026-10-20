import { describe, expect, it } from 'vitest'
import { areaRadiusScale, cohortRows } from './proportionalSymbols.js'

describe('areaRadiusScale', () => {
  it('gives zero and missing values no circle', () => {
    const scale = areaRadiusScale([0, 4, null, NaN], { maxRadius: 32, minRadius: 2 })
    expect(scale.maximum).toBe(4)
    for (const value of [0, null, undefined, NaN, Infinity]) expect(scale.radius(value)).toBe(0)
  })

  it('makes circle area proportional to the absolute value', () => {
    const scale = areaRadiusScale([1, 4, -16], { maxRadius: 32 })
    expect(scale.maximum).toBe(16)
    expect(scale.radius(16)).toBe(32)
    expect(scale.radius(-16)).toBe(32)
    expect(scale.radius(4) ** 2 / scale.radius(1) ** 2).toBeCloseTo(4)
    expect(scale.radius(4)).toBe(16)
  })

  it('applies the minimum only to nonzero values', () => {
    const scale = areaRadiusScale([1, 10_000], { maxRadius: 30, minRadius: 3 })
    expect(scale.radius(1)).toBe(3)
    expect(scale.radius(0)).toBe(0)
  })

  it('draws nothing when every value is zero or missing', () => {
    const scale = areaRadiusScale([0, null], { maxRadius: 32 })
    expect(scale.maximum).toBe(0)
    expect(scale.radius(0)).toBe(0)
  })
})

describe('cohortRows', () => {
  const rows = [
    { name: 'A', year: 2020, measure: 'count', value: 100 },
    { name: 'B', year: 2020, measure: 'count', value: 25 },
    { name: 'A', year: 2021, measure: 'count', value: 400 },
    { name: 'A', year: 2020, measure: 'rate', value: 9 },
  ]

  it('keeps every row in the shown rows’ comparison scopes', () => {
    expect(cohortRows(rows, [rows[1]], ['year', 'measure'])).toEqual([rows[0], rows[1]])
    expect(cohortRows(rows, [rows[1], rows[2]], ['year', 'measure'])).toEqual([rows[0], rows[1], rows[2]])
  })

  it('uses every row when there is no scope', () => {
    expect(cohortRows(rows, [], [])).toEqual(rows)
  })

  it('does not enlarge a symbol when a filter hides its comparators', () => {
    const scaleFor = (shown: typeof rows) =>
      areaRadiusScale(
        cohortRows(rows, shown, ['year', 'measure']).map((row) => row.value),
        { maxRadius: 32 },
      )
    const all = scaleFor(rows.slice(0, 2))
    const filtered = scaleFor([rows[1]])
    expect(filtered.maximum).toBe(all.maximum)
    expect(filtered.radius(25)).toBe(all.radius(25))
    expect(filtered.radius(25)).toBe(16)
  })
})
