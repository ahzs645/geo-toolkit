import { describe, expect, it } from 'vitest'
import { canEncodeAsArea, crosswalkResolver, groupByJoin, groupValue, joinDiagnostics } from './joins.js'

describe('crosswalkResolver', () => {
  it('prefers reviewed links, falls back to native codes and rejects the rest', () => {
    const resolve = crosswalkResolver({ links: [['5911', '11']], native: ['11', '12'] })
    expect(resolve('5911')).toBe('11')
    expect(resolve(5911)).toBe('11')
    expect(resolve('12')).toBe('12')
    expect(resolve('99')).toBeNull()
    for (const blank of [null, undefined, '']) expect(resolve(blank)).toBeNull()
  })

  it('accepts records and maps, and links without a native fallback', () => {
    expect(crosswalkResolver({ links: { 'Prince George': 'pg' } })('Prince George')).toBe('pg')
    expect(crosswalkResolver({ links: new Map([['a', 'b']]) })('b')).toBeNull()
    expect(crosswalkResolver({ native: new Set(['x']) })('x')).toBe('x')
  })
})

describe('groupByJoin', () => {
  it('groups in first-seen order and omits unjoined rows', () => {
    const rows = [{ code: 'b' }, { code: null }, { code: 'a' }, { code: 'b' }]
    const groups = groupByJoin(rows, (row) => row.code)
    expect([...groups.keys()]).toEqual(['b', 'a'])
    expect(groups.get('b')).toEqual([rows[0], rows[3]])
  })
})

describe('groupValue', () => {
  it('shows one finite value whether or not the metric sums', () => {
    expect(groupValue([4], { allowsSum: false })).toBe(4)
    expect(groupValue([0], { allowsSum: true })).toBe(0)
  })

  it('sums several values only for an additive metric', () => {
    expect(groupValue([1, 2, 3], { allowsSum: true })).toBe(6)
    expect(groupValue([1, 2, 3], { allowsSum: false })).toBeNull()
  })

  it('withholds the value when any input is missing', () => {
    for (const missing of [null, undefined, NaN, Infinity, '4'])
      expect(groupValue([1, missing], { allowsSum: true })).toBeNull()
    expect(groupValue([], { allowsSum: true })).toBeNull()
  })
})

describe('joinDiagnostics', () => {
  const rows = [
    { code: 'a', value: 1 },
    { code: 'b', value: 2 },
    { code: 'b', value: 3 },
    { code: 'c', value: null },
    { code: null, value: 5 },
    { code: 'gone', value: 6 },
  ]
  const options = {
    joinOf: (row: (typeof rows)[number]) => row.code,
    valueOf: (row: (typeof rows)[number]) => row.value,
  }

  it('counts shared codes as ambiguous unless the metric sums', () => {
    expect(joinDiagnostics(rows, { ...options, allowsSum: false })).toEqual({
      total: 6,
      matched: 3,
      missing: 1,
      unmatched: 1,
      ambiguous: 2,
    })
    expect(joinDiagnostics(rows, { ...options, allowsSum: true })).toMatchObject({ matched: 5, ambiguous: 0 })
  })

  it('treats codes missing from loaded geometry as unmatched', () => {
    const available = new Set(['a', 'b', 'c'])
    expect(joinDiagnostics(rows, { ...options, allowsSum: true, available })).toMatchObject({
      matched: 4,
      missing: 1,
      unmatched: 2,
    })
  })
})

describe('canEncodeAsArea', () => {
  it('rejects any negative number and ignores non-numbers', () => {
    expect(canEncodeAsArea([0, 3, null, 'x', NaN])).toBe(true)
    expect(canEncodeAsArea([3, -0.5])).toBe(false)
    expect(canEncodeAsArea([-Infinity])).toBe(false)
  })
})
