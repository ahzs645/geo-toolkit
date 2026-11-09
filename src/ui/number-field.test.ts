import { describe, expect, it } from 'vitest'
import { formatNumberFieldValue, resolveNumberFieldInput, stepNumberFieldValue } from './number-field.js'

describe('numeric field value policies', () => {
  it('preserves a partial draft without turning a missing required measurement into zero', () => {
    expect(resolveNumberFieldInput('', 'change')).toEqual({ accepted: false })
    expect(resolveNumberFieldInput('-', 'change')).toEqual({ accepted: false })
    expect(resolveNumberFieldInput('1e', 'change')).toEqual({ accepted: false })
    expect(resolveNumberFieldInput('0', 'change')).toEqual({ accepted: true, value: 0 })
    expect(resolveNumberFieldInput('', 'commit', { nullable: true })).toEqual({ accepted: true, value: null })
    expect(resolveNumberFieldInput('', 'change', { blankValue: 'zero' })).toEqual({ accepted: true, value: 0 })
  })

  it('allows bounds to be committed, immediate, or advisory without changing the policy silently', () => {
    const bounds = { min: 1, max: 10 }
    expect(resolveNumberFieldInput('15', 'change', bounds)).toEqual({ accepted: false })
    expect(resolveNumberFieldInput('15', 'commit', bounds)).toEqual({ accepted: true, value: 10 })
    expect(resolveNumberFieldInput('15', 'change', { ...bounds, clampOn: 'change' })).toEqual({
      accepted: true,
      value: 10,
    })
    expect(resolveNumberFieldInput('15', 'commit', { ...bounds, clampOn: 'never' })).toEqual({
      accepted: true,
      value: 15,
    })
    expect(resolveNumberFieldInput('bad', 'change', { nullable: true, invalidValue: 'null' })).toEqual({
      accepted: true,
      value: null,
    })
  })

  it('steps from the current draft, clamps bounds and avoids float residue', () => {
    expect(stepNumberFieldValue(0.2, 1, { step: 0.1 })).toBe(0.3)
    expect(stepNumberFieldValue(9.5, 1, { step: 1, max: 10 })).toBe(10)
    expect(stepNumberFieldValue(null, 1, { step: 0.25, min: 2 })).toBe(2.25)
    expect(stepNumberFieldValue(0, -1, { min: 0, step: 1, clampOn: 'never' })).toBe(0)
  })

  it('shows the source value unless asked to round, and keeps trailing decimals only when asked', () => {
    expect(formatNumberFieldValue(null)).toBe('')
    expect(formatNumberFieldValue(283.456789)).toBe('283.456789')
    expect(formatNumberFieldValue(283, { precision: 2 })).toBe('283')
    expect(formatNumberFieldValue(283.456, { precision: 2 })).toBe('283.46')
    expect(formatNumberFieldValue(283, { precision: 2, fixedDecimals: true })).toBe('283.00')
    expect(formatNumberFieldValue(283.4, { precision: 2, fixedDecimals: true })).toBe('283.40')
    expect(formatNumberFieldValue(-0.001, { precision: 2, fixedDecimals: true })).toBe('0.00')
    expect(formatNumberFieldValue(12.5, { precision: 0, fixedDecimals: true })).toBe('13')
    // Without a precision there is nothing to pad.
    expect(formatNumberFieldValue(283, { fixedDecimals: true })).toBe('283')
  })
})
