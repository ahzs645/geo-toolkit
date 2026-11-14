import { describe, expect, it } from 'vitest'
import { COLOR_RAMPS, colorRamp, colorRampCss } from './colorRamps.js'
import { samplePalette } from './paletteScale.js'

describe('colour ramps', () => {
  it('offers each ramp once, as hex anchors the palette scale can sample', () => {
    expect(new Set(COLOR_RAMPS.map(({ id }) => id)).size).toBe(COLOR_RAMPS.length)
    for (const { colors } of COLOR_RAMPS) {
      expect(colors).toHaveLength(9)
      expect(colors.every((value) => /^#[0-9a-f]{6}$/.test(value))).toBe(true)
      expect(samplePalette({ colors, interpolation: 'lab' }, 5)).toHaveLength(5)
    }
  })

  it('reads the ramps low to high', () => {
    expect(colorRamp('viridis')!.colors[0]).toBe('#440154')
    expect(colorRamp('viridis')!.colors.at(-1)).toBe('#fde725')
    // A diverging ramp is pale and near neutral in the middle.
    const middle = [1, 3, 5].map((at) => parseInt(colorRamp('rdbu')!.colors[4].slice(at, at + 2), 16))
    expect(Math.min(...middle)).toBeGreaterThan(230)
    expect(Math.max(...middle) - Math.min(...middle)).toBeLessThan(12)
    expect(colorRamp('nope')).toBeUndefined()
  })

  it('previews a ramp as a gradient, in either direction', () => {
    expect(colorRampCss(['#000000', '#ffffff'])).toBe('linear-gradient(to right, #000000, #ffffff)')
    expect(colorRampCss(['#000000', '#ffffff'], true)).toBe('linear-gradient(to right, #ffffff, #000000)')
    expect(colorRampCss(['#123456'])).toBe('linear-gradient(to right, #123456, #123456)')
    expect(colorRampCss([])).toBe('transparent')
  })
})
