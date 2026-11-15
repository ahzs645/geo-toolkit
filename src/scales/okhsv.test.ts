import { describe, expect, it } from 'vitest'
import { hexToOkhsv, okhsvSwatches, okhsvToHex } from './okhsv.js'
import { hexToOklch, isOklchInGamut, oklchToHex } from './oklch.js'

const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
const farthest = (a: string, b: string) => Math.max(...channels(a).map((value, i) => Math.abs(value - channels(b)[i])))

describe('Okhsv', () => {
  it('returns the colour it was given, to a channel step', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#facc15', '#7c3aed', '#0f172a', '#f8fafc', '#808080'])
      expect(farthest(okhsvToHex(hexToOkhsv(hex)), hex)).toBeLessThanOrEqual(1)
  })

  it('reads the primaries at full saturation and value, and greys with none', () => {
    const red = hexToOkhsv('#ff0000')
    expect(red.s).toBeCloseTo(100, 0)
    expect(red.v).toBeCloseTo(100, 0)
    // Oklab puts sRGB red at 29°, not 0°.
    expect(red.h).toBeCloseTo(29.2, 0)
    expect(hexToOkhsv('#808080').s).toBe(0)
    expect(hexToOkhsv('#000000')).toEqual({ h: 0, s: 0, v: 0 })
    expect(hexToOkhsv('#ffffff').v).toBeCloseTo(100, 3)
  })

  it('gives black at no value and white at no saturation, whatever the hue', () => {
    expect(okhsvToHex({ h: 200, s: 80, v: 0 })).toBe('#000000')
    expect(okhsvToHex({ h: 200, s: 0, v: 100 })).toBe('#ffffff')
    expect(okhsvToHex({ h: -160, s: 60, v: 70 })).toBe(okhsvToHex({ h: 200, s: 60, v: 70 }))
  })

  it('generates a grid of distinct swatches with a neutral row from white to black', () => {
    const swatches = okhsvSwatches()
    expect(swatches).toHaveLength(36)
    expect(new Set(swatches).size).toBe(36)
    expect(swatches.at(-6)).toBe('#ffffff')
    expect(swatches.at(-1)).toBe('#000000')
    expect(swatches.every((hex) => /^#[0-9a-f]{6}$/.test(hex))).toBe(true)
  })
})

describe('OKLCH', () => {
  it('returns the colour it was given', () => {
    for (const hex of ['#ff0000', '#22d3ee', '#7c3aed', '#111827', '#ffffff'])
      expect(farthest(oklchToHex(hexToOklch(hex)), hex)).toBeLessThanOrEqual(1)
  })

  it('reduces chroma, holding lightness and hue, for a colour sRGB cannot show', () => {
    const vivid = { l: 0.7, c: 0.37, h: 145 }
    expect(isOklchInGamut(vivid)).toBe(false)
    const shown = hexToOklch(oklchToHex(vivid))
    expect(shown.c).toBeLessThan(vivid.c)
    expect(shown.l).toBeCloseTo(vivid.l, 1)
    expect(Math.abs(shown.h - vivid.h)).toBeLessThan(2)
  })
})
