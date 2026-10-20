import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatCompactCurrency,
  formatMeasure,
  formatMonthYear,
  formatNumber,
  formatPercentValue,
  formatSquareKm,
  MONTH_NAMES,
  MONTH_SHORT_NAMES,
} from './index.js'

describe('pinned-locale formatters', () => {
  it('formats numbers with fallbacks', () => {
    expect(formatNumber(1234.6)).toBe('1,235')
    expect(formatNumber(null)).toBe('No value')
    expect(formatNumber(Number.NaN, { fallback: '—' })).toBe('—')
    expect(formatPercentValue(12.34)).toBe('12.3%')
    expect(formatCompactCurrency(-2_500_000)).toBe('-$2.5M')
  })

  it('scales bytes and areas and names months', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatSquareKm(12.34)).toBe('12.3 km²')
    expect(MONTH_NAMES[0]).toBe('January')
    expect(MONTH_SHORT_NAMES[8]).toBe('Sep')
    expect(formatMonthYear(new Date(2026, 8, 1))).toBe('Sep 2026')
  })
})

describe('formatMeasure', () => {
  it('places units', () => {
    expect(formatMeasure(1234.56)).toBe('1,234.6')
    expect(formatMeasure(12.34, '%')).toBe('12.3%')
    expect(formatMeasure(12.34, 'percent')).toBe('12.3%')
    expect(formatMeasure(4.25, 'km', { maximumFractionDigits: 2 })).toBe('4.25 km')
    expect(formatMeasure(3, 'CAD/hour')).toBe('3 CAD/hour')
  })

  it('formats Canadian dollar units as currency', () => {
    expect(formatMeasure(1234.567, 'CAD', { maximumFractionDigits: 2 })).toBe('$1,234.57')
    expect(formatMeasure(1200, '$')).toBe('$1,200')
    expect(formatMeasure(-5, 'CAD $')).toBe('-$5')
  })

  it('uses the fallback for missing and non-finite values', () => {
    expect(formatMeasure(null, '%')).toBe('No value')
    expect(formatMeasure(undefined, 'km', { fallback: 'Not reported' })).toBe('Not reported')
    expect(formatMeasure(Number.POSITIVE_INFINITY)).toBe('No value')
  })

  it('accepts a minimum precision above the default maximum', () => {
    expect(formatMeasure(2, undefined, { minimumFractionDigits: 2 })).toBe('2.00')
    expect(formatMeasure(0.000123, '%', { maximumFractionDigits: 6 })).toBe('0.000123%')
  })
})
