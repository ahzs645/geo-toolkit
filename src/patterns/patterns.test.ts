import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ORGANIC_HATCH,
  ORGANIC_HATCH_PRESETS,
  estimateOrganicHatchStrokes,
  organicHatchChunk,
  organicHatchRecipe,
  organicHatchStrokePath,
  organicHatchStrokes,
  organicHatchSvgGroup,
  organicHatchSvgLayer,
  organicHatchTile,
  organicHatchTileStrokes,
  parseOrganicHatchRecipe,
  readOrganicHatchOptions,
  recipeStrokes,
  type OrganicHatchStroke,
} from './index.js'

const key = (stroke: OrganicHatchStroke) => `${organicHatchStrokePath(stroke)}|${stroke.width.toFixed(6)}`

describe('organic hatch field', () => {
  it('draws the same strokes as the SVG group for the same artboard', () => {
    const svg = organicHatchSvgGroup(420, 260, { seed: 3 })
    const fromSvg = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])
    const { strokes } = organicHatchStrokes({ x: 0, y: 0, width: 420, height: 260 }, { seed: 3 })
    expect(strokes.map(organicHatchStrokePath)).toEqual(fromSvg)
    expect(svg).toContain('data-budget-limited="false"')
  })

  it('agrees between neighbouring windows that share its origin', () => {
    const options = { seed: 12, curvature: 14 }
    const whole = organicHatchStrokes({ x: 300, y: 200, width: 400, height: 240 }, options).strokes
    const left = organicHatchStrokes({ x: 300, y: 200, width: 200, height: 240 }, options).strokes
    const right = organicHatchStrokes({ x: 500, y: 200, width: 200, height: 240 }, options).strokes
    const union = new Set([...left, ...right].map(key))
    expect(new Set(whole.map(key))).toEqual(union)
    // Strokes crossing the shared edge are the same strokes in both windows.
    const shared = left.map(key).filter((k) => right.map(key).includes(k))
    expect(shared.length).toBeGreaterThan(10)
  })

  it('keeps its density fixed and refuses a window it cannot draw at that density', () => {
    const small = organicHatchStrokes({ x: 0, y: 0, width: 200, height: 200 }, {}).strokes.length
    const large = organicHatchStrokes({ x: 0, y: 0, width: 400, height: 400 }, {}).strokes.length
    expect(large / small).toBeGreaterThan(3.3)
    expect(() =>
      organicHatchStrokes({ x: 0, y: 0, width: 3000, height: 3000 }, { spacing: 1.5, bandHeight: 8 }),
    ).toThrow(RangeError)
    expect(estimateOrganicHatchStrokes({ x: 0, y: 0, width: 0, height: 10 })).toBe(0)
  })

  it('clamps loose options and keeps the documented defaults', () => {
    expect(readOrganicHatchOptions({ spacing: 0, curvature: 99, seed: 4.7 })).toEqual({
      ...DEFAULT_ORGANIC_HATCH,
      spacing: 1.5,
      curvature: 24,
      seed: 4,
    })
  })

  it('makes a tile with whole bands that wraps at its edges', () => {
    const tile = organicHatchTileStrokes({}, { width: 180, height: 100 })
    expect(Math.round(tile.height / tile.bandHeight)).toBeCloseTo(tile.height / tile.bandHeight, 9)
    expect(tile.strokes.length).toBeGreaterThan(200)
    expect(tile.strokes.every((s) => s.start.x >= -40 && s.start.x <= 220)).toBe(true)
  })
})

describe('hatch recipe', () => {
  it('round-trips through JSON and refuses what it cannot draw', () => {
    const recipe = organicHatchRecipe({ seed: 41, color: '#336699', origin: [12, -4], scale: 0.5 })
    expect(parseOrganicHatchRecipe(JSON.parse(JSON.stringify(recipe)))).toEqual(recipe)
    expect(parseOrganicHatchRecipe({ ...recipe, color: '#AABBCC', opacity: undefined }).color).toBe('#aabbcc')
    expect(() => parseOrganicHatchRecipe({ ...recipe, version: 2 })).toThrow(/version 2/)
    expect(() => parseOrganicHatchRecipe({ ...recipe, spacing: 40 })).toThrow(/spacing/)
    expect(() => parseOrganicHatchRecipe({ ...recipe, seed: 1.5 })).toThrow(/whole number/)
    expect(() => parseOrganicHatchRecipe({ ...recipe, color: 'green' })).toThrow(/colour/)
    expect(() => parseOrganicHatchRecipe({ ...recipe, type: 'dots' })).toThrow(/type/)
    for (const preset of Object.values(ORGANIC_HATCH_PRESETS))
      expect(parseOrganicHatchRecipe(preset.recipe)).toEqual(preset.recipe)
  })

  it('places the field at its origin and scale', () => {
    const plain = organicHatchStrokes({ x: 0, y: 0, width: 100, height: 60 }, {}).strokes
    const placed = recipeStrokes(organicHatchRecipe({ origin: [10, 20], scale: 2 }), {
      x: 10,
      y: 20,
      width: 200,
      height: 120,
    })
    expect(placed).toHaveLength(plain.length)
    expect(placed[5].start.x).toBeCloseTo(10 + plain[5].start.x * 2, 9)
    expect(placed[5].end.y).toBeCloseTo(20 + plain[5].end.y * 2, 9)
    expect(placed[5].width).toBeCloseTo(plain[5].width * 2, 9)
  })
})

describe('hatch SVG layer', () => {
  it('clips to coverage then land, and records its recipe', () => {
    const recipe = organicHatchRecipe({ opacity: 0.8 })
    const svg = organicHatchSvgLayer({
      recipe,
      window: { x: 0, y: 0, width: 200, height: 120 },
      land: 'M0 0H200V120H0Z M50 50H80V80H50Z',
      coverage: ['M0 0H120V120H0Z', 'M100 0H200V60H100Z'],
      id: 'forest',
    })
    expect(svg).toContain('<clipPath id="forest-land"><path d="M0 0H200V120H0Z M50 50H80V80H50Z" clip-rule="evenodd"/>')
    expect(svg).toContain(
      '<clipPath id="forest-coverage"><path d="M0 0H120V120H0Z"/><path d="M100 0H200V60H100Z"/></clipPath>',
    )
    expect(svg.indexOf('url(#forest-land)')).toBeLessThan(svg.indexOf('url(#forest-coverage)'))
    expect(svg).toContain('opacity="0.8"')
    const json = svg.match(/data-recipe="([^"]+)"/)![1].replace(/&quot;/g, '"')
    expect(parseOrganicHatchRecipe(JSON.parse(json))).toEqual(recipe)
    const count = Number(svg.match(/data-stroke-count="(\d+)"/)![1])
    expect((svg.match(/<path d="M[-\d.]+ [-\d.]+C/g) ?? []).length).toBe(count)
  })
})

describe('hatch rasters', () => {
  it('draws neighbouring chunks of the open field without a seam', () => {
    const recipe = organicHatchRecipe({ scale: 0.75 })
    const options = { pixelsPerUnit: 2 }
    const whole = organicHatchChunk(recipe, { x: 40, y: 30, width: 80, height: 50 }, options)
    const left = organicHatchChunk(recipe, { x: 40, y: 30, width: 40, height: 50 }, options)
    const right = organicHatchChunk(recipe, { x: 80, y: 30, width: 40, height: 50 }, options)
    for (let y = 0; y < whole.height; y++) {
      const row = (image: { width: number; data: Uint8ClampedArray }, x0: number, x1: number) =>
        Array.from(image.data.subarray((y * image.width + x0) * 4, (y * image.width + x1) * 4))
      expect(row(left, 0, left.width)).toEqual(row(whole, 0, left.width))
      expect(row(right, 0, right.width)).toEqual(row(whole, left.width, whole.width))
    }
  })

  it('makes a repeating tile with even ink across its edges', () => {
    const tile = organicHatchTile(organicHatchRecipe(), {
      pixelsPerUnit: 1,
      targetPx: 160,
      background: { color: '#ffffff' },
    })
    expect(tile.data.length).toBe(tile.width * tile.height * 4)
    const ink = (x0: number, x1: number) => {
      let sum = 0
      for (let y = 0; y < tile.height; y++)
        for (let x = x0; x < x1; x++) sum += 255 - tile.data[(y * tile.width + x) * 4]
      return sum / ((x1 - x0) * tile.height)
    }
    const interior = ink(20, tile.width - 20)
    for (const edge of [ink(0, 4), ink(tile.width - 4, tile.width)]) {
      expect(edge).toBeGreaterThan(interior * 0.6)
      expect(edge).toBeLessThan(interior * 1.4)
    }
    expect(tile.period.width).toBe(tile.width)
    expect(tile.data[3]).toBe(255)
  })
})
