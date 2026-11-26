import { describe, expect, it } from 'vitest'
import { mercatorUnit, organicHatchRecipe, prepareHatchAreas, renderHatchTile, type LngLatRings } from './index.js'

const square = (w: number, s: number, e: number, n: number) =>
  [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
  ] as [number, number][]

/** The tile (at zoom z) holding a longitude and latitude. */
const tileAt = (lng: number, lat: number, z: number) => {
  const [x, y] = mercatorUnit(lng, lat)
  return [Math.floor(x * 2 ** z), Math.floor(y * 2 ** z)]
}

const inked = (image: { data: Uint8ClampedArray }, px: number, py: number, width: number) =>
  image.data[(py * width + px) * 4 + 3] > 0

describe('hatch map tiles', () => {
  for (const style of ['contour', 'patch'] as const) {
    it(`draw the same ${style} field whatever the tile size, so tiles meet without a seam`, () => {
      const recipe = organicHatchRecipe({ style, scale: 0.8 })
      const land: LngLatRings = [square(-130, 45, -110, 60)]
      const areas = prepareHatchAreas({ land })
      const anchor = [-131, 61] as const
      const [x, y] = tileAt(-122, 53, 7)
      const big = renderHatchTile(areas, recipe, anchor, 7, x, y, { tileSize: 512 })!
      const small = renderHatchTile(areas, recipe, anchor, 8, 2 * x + 1, 2 * y, { tileSize: 256 })!
      expect(big.width).toBe(512)
      for (let row = 0; row < 256; row += 7) {
        const a = Array.from(big.data.subarray((row * 512 + 256) * 4, (row * 512 + 512) * 4))
        const b = Array.from(small.data.subarray(row * 256 * 4, (row + 1) * 256 * 4))
        expect(a).toEqual(b)
      }
    })
  }

  it('ink only land inside the chosen coverage, leaving lakes clear', () => {
    // A square of land with a lake, and coverage over its western half (two overlapping parts).
    const land: LngLatRings = [square(-124, 50, -120, 54), square(-122.5, 51.5, -121.5, 52.5)]
    const coverage = [[square(-124, 50, -122, 54)], [square(-123, 51, -121.8, 53)]]
    const areas = prepareHatchAreas({ land, coverage })
    const recipe = organicHatchRecipe({ style: 'patch', opacity: 1 })
    const z = 6
    const [x, y] = tileAt(-122, 52, z)
    const tile = renderHatchTile(areas, recipe, [-125, 55], z, x, y, { tileSize: 512 })!
    const pixel = (lng: number, lat: number) => {
      const [u, v] = mercatorUnit(lng, lat)
      return [Math.floor((u * 2 ** z - x) * 512), Math.floor((v * 2 ** z - y) * 512)]
    }
    const inkNear = (lng: number, lat: number) => {
      const [px, py] = pixel(lng, lat)
      let count = 0
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (inked(tile, px + dx, py + dy, 512)) count++
      return count
    }
    expect(inkNear(-123.5, 52)).toBeGreaterThan(20) // covered land
    expect(inkNear(-120.5, 52)).toBe(0) // land outside coverage
    expect(inkNear(-122, 52)).toBe(0) // the lake, inside the overlapping coverage
    expect(inkNear(-125.5, 52)).toBe(0) // sea
    // A tile with none of the areas is no tile at all.
    const [fx, fy] = tileAt(-100, 40, z)
    expect(renderHatchTile(areas, recipe, [-125, 55], z, fx, fy)).toBeNull()
  })
})
