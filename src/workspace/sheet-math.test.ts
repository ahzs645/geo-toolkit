import { describe, expect, it } from 'vitest'
import { getSnapPositions, resolveSnap, sheetOpenProgress, stateFromTranslate } from './sheet-math.js'

describe('mobile sheet geometry', () => {
  it('preserves the peek and safe toolbar offset across container heights', () => {
    for (const height of [160, 320, 500, 844]) {
      const snaps = getSnapPositions(height, 68, 92)
      expect(snaps.full).toBeLessThanOrEqual(snaps.half)
      expect(snaps.half).toBeLessThanOrEqual(snaps.collapsed)
      expect(height - snaps.collapsed).toBeGreaterThanOrEqual(Math.min(88, height))
      expect(stateFromTranslate(snaps.collapsed, height, 68, 92)).toBe('collapsed')
    }
  })
  it('uses swipe velocity to choose the destination rather than only the release position', () => {
    const height = 600
    const y = getSnapPositions(height).half
    expect(resolveSnap(y, 0, height)).toBe('half')
    expect(resolveSnap(y, -2, height)).toBe('full')
    expect(resolveSnap(y, 2, height)).toBe('collapsed')
  })
  it('keeps valid ordered snaps when an external toolbar fills most of a short embed', () => {
    const snaps = getSnapPositions(300, 250)
    expect(snaps.full).toBeLessThanOrEqual(snaps.half)
    expect(snaps.half).toBeLessThanOrEqual(snaps.collapsed)
    expect(snaps.collapsed).toBeLessThan(300)
  })
  it('keeps the scrim finite when the toolbar leaves only one available snap', () => {
    const snaps = getSnapPositions(160, 250)
    expect(snaps.full).toBe(snaps.collapsed)
    expect(sheetOpenProgress(snaps.full, snaps.full, snaps.collapsed)).toBe(0)
    expect(sheetOpenProgress(200, 100, 500)).toBe(0.75)
    expect(sheetOpenProgress(0, 100, 500)).toBe(1)
    expect(sheetOpenProgress(600, 100, 500)).toBe(0)
  })
})
