import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PATCH_HATCH,
  ORGANIC_HATCH_PRESETS,
  organicHatchChunk,
  organicHatchRecipe,
  organicHatchStrokePath,
  organicHatchTile,
  parseOrganicHatchRecipe,
  patchHatchStrokes,
  patchHatchTileStrokes,
  readPatchHatchOptions,
  recipeStrokes,
  type OrganicHatchStroke,
} from './index.js'

const key = (stroke: OrganicHatchStroke) => `${organicHatchStrokePath(stroke)}|${stroke.width.toFixed(6)}`
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)]

describe('patch hatch field', () => {
  it('draws the same strokes in neighbouring windows, anywhere', () => {
    for (const origin of [0, 1_000_000]) {
      const whole = patchHatchStrokes({ x: origin + 100, y: 40, width: 240, height: 160 }).strokes
      const left = patchHatchStrokes({ x: origin + 100, y: 40, width: 120, height: 160 }).strokes
      const right = patchHatchStrokes({ x: origin + 220, y: 40, width: 120, height: 160 }).strokes
      expect(new Set(whole.map(key))).toEqual(new Set([...left, ...right].map(key)))
    }
  })

  it('keeps the texture fitted to page 8', () => {
    // The fit was made on rendered images, with the structure-tensor lean that `measure` scripts
    // report (median 6.5°, 90th percentile 26°, as page 8); these are the same strokes' own
    // geometry, which reads steeper because it is not smoothed. They guard the fit, not set it.
    const { strokes } = patchHatchStrokes({ x: 0, y: 0, width: 600, height: 420 })
    expect(strokes.length).toBeGreaterThan(7_500)
    expect(strokes.length).toBeLessThan(9_500)
    const lengths = strokes.map((s) => Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y))
    expect(percentile(lengths, 0.5)).toBeGreaterThan(5.5)
    expect(percentile(lengths, 0.5)).toBeLessThan(8.5)
    const leans = strokes.map((s) => Math.abs((Math.atan2(s.end.x - s.start.x, s.end.y - s.start.y) * 180) / Math.PI))
    expect(percentile(leans, 0.5)).toBeGreaterThan(8)
    expect(percentile(leans, 0.5)).toBeLessThan(16)
    expect(percentile(leans, 0.9)).toBeGreaterThan(26)
    expect(percentile(leans, 0.9)).toBeLessThan(42)
  })

  it('clamps loose options to its limits', () => {
    expect(readPatchHatchOptions({ patchSize: 5, lean: 99, seed: 2.9 })).toEqual({
      ...DEFAULT_PATCH_HATCH,
      patchSize: 20,
      lean: 60,
      seed: 2,
    })
  })

  it('makes a tile that wraps its patch lattice', () => {
    const tile = patchHatchTileStrokes({}, { columns: 2, rows: 2 })
    expect(tile.width).toBe(2 * DEFAULT_PATCH_HATCH.patchSize)
    expect(tile.height).toBe(DEFAULT_PATCH_HATCH.patchSize)
    expect(tile.strokes.length).toBeGreaterThan(1_000)
  })
})

describe('patch hatch recipes', () => {
  it('are version 2 and round-trip; version 1 cannot name a style', () => {
    const recipe = ORGANIC_HATCH_PRESETS['page-8-reference'].recipe
    expect(recipe).toMatchObject({ version: 2, style: 'patch', patch: { patchSize: 300 } })
    expect(parseOrganicHatchRecipe(JSON.parse(JSON.stringify(recipe)))).toEqual(recipe)
    expect(() => parseOrganicHatchRecipe({ ...recipe, version: 1 })).toThrow(/needs version 2/)
    expect(() => parseOrganicHatchRecipe({ ...recipe, patch: undefined })).toThrow(/patch settings/)
    expect(() => parseOrganicHatchRecipe({ ...recipe, style: 'dots' })).toThrow(/unknown style/)
    expect(() => parseOrganicHatchRecipe({ ...recipe, patch: { ...recipe.patch, lean: 90 } })).toThrow(/lean/)
    const contour = organicHatchRecipe({ style: 'contour' })
    expect(contour).not.toHaveProperty('style')
    expect(contour.version).toBe(1)
    expect(parseOrganicHatchRecipe({ ...contour, version: 2, style: 'contour' })).toMatchObject({
      version: 2,
      style: 'contour',
    })
  })

  it('draws patch strokes at the recipe origin and scale', () => {
    const recipe = organicHatchRecipe({ style: 'patch', origin: [50, 20], scale: 0.5 })
    const placed = recipeStrokes(recipe, { x: 50, y: 20, width: 100, height: 60 })
    const plain = patchHatchStrokes({ x: 0, y: 0, width: 200, height: 120 }).strokes
    expect(placed.length).toBe(plain.length)
    expect(placed[3].start.x).toBeCloseTo(50 + plain[3].start.x * 0.5, 9)
  })

  it('rasterises seamless chunks and a repeating tile', () => {
    const recipe = organicHatchRecipe({ style: 'patch', scale: 0.5 })
    const options = { pixelsPerUnit: 2 }
    const whole = organicHatchChunk(recipe, { x: 0, y: 0, width: 80, height: 40 }, options)
    const left = organicHatchChunk(recipe, { x: 0, y: 0, width: 40, height: 40 }, options)
    for (let y = 0; y < whole.height; y++)
      expect(Array.from(left.data.subarray(y * left.width * 4, (y + 1) * left.width * 4))).toEqual(
        Array.from(whole.data.subarray(y * whole.width * 4, (y * whole.width + left.width) * 4)),
      )
    const tile = organicHatchTile(recipe, { pixelsPerUnit: 1, targetPx: 300 })
    expect(tile.width).toBe(tile.height * 2)
    expect(tile.width % 2).toBe(0)
  })
})
