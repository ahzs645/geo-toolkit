import { describe, expect, it } from 'vitest'
import { parseScrubInput, scrubDragValue, scrubFraction, snapScrubValue } from './scrub-number.js'

describe('scrub number maths', () => {
  it('snaps to the step grid anchored at min, clamps, and drops float residue', () => {
    expect(snapScrubValue(51.3, { min: 30, max: 82.5, step: 2.5 })).toBe(52.5)
    expect(snapScrubValue(0.1 + 0.2, { step: 0.1 })).toBe(0.3)
    expect(snapScrubValue(200, { min: 30, max: 82.5, step: 2.5 })).toBe(82.5)
    expect(snapScrubValue(-5, { min: 0 })).toBe(0)
    expect(snapScrubValue(Number.NaN, { min: 8, max: 80 })).toBe(8)
    expect(snapScrubValue(7, { min: 1, step: 3 })).toBe(7)
  })

  it('maps a full-width drag to the whole range when both bounds are set', () => {
    const range = { min: 0, max: 100, step: 1, width: 200 }
    expect(scrubDragValue(50, 100, range)).toBe(100)
    expect(scrubDragValue(50, -40, range)).toBe(30)
    expect(scrubDragValue(50, 100, { ...range, precision: 0.1 })).toBe(55)
  })

  it('moves one step per pixelsPerStep when a bound is open', () => {
    expect(scrubDragValue(10, 20, { step: 1, width: 100 })).toBe(15)
    expect(scrubDragValue(10, 20, { step: 0.5, width: 100, pixelsPerStep: 2 })).toBe(15)
  })

  it('reads typed values with units and decimal commas, rejecting text', () => {
    expect(parseScrubInput(' 50 % ')).toBe(50)
    expect(parseScrubInput('201mm')).toBe(201)
    expect(parseScrubInput('2,5')).toBe(2.5)
    expect(parseScrubInput('-.5')).toBe(-0.5)
    expect(parseScrubInput('1e3')).toBe(1000)
    expect(parseScrubInput('abc')).toBeNull()
    expect(parseScrubInput('')).toBeNull()
    expect(parseScrubInput('5 6')).toBeNull()
  })

  it('reports the fill fraction only for a closed range', () => {
    expect(scrubFraction(56.25, { min: 30, max: 82.5 })).toBeCloseTo(0.5)
    expect(scrubFraction(500, { min: 0, max: 100 })).toBe(1)
    expect(scrubFraction(5, { min: 0 })).toBeNull()
  })
})
