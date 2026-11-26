/**
 * A hatch as Web Mercator map tiles: each tile is that window of the open field, inked only where
 * the areas allow, drawn on the same 4 × 4 sample grid as the strokes so both edges stay
 * antialiased together. Tiles of one recipe meet without a seam, so a map shows more of the same
 * field as it pans; nothing is a repeating image.
 *
 * Where paint goes follows the recipe's rule: `land` (even-odd, so lakes are holes and islands
 * count) intersected with `coverage` (the chosen areas, a union: overlaps are inked once). The
 * field is anchored to the ground at `anchor` and drawn in CSS pixels of each tile's zoom, so its
 * strokes keep their size on screen at whole zooms; past `maxFieldZoom` the map enlarges the last
 * level's tiles, and the strokes grow with the ground. Pure arithmetic; no DOM or network access.
 */
import { composeHatch, coverHatchStrokes, type HatchRgbaImage } from './raster.js'
import { recipeFieldStrokes, type OrganicHatchRecipe } from './recipe.js'

/** Rings of `[longitude, latitude]` points. */
export type LngLatRings = readonly (readonly (readonly [number, number])[])[]

export interface HatchTileAreas {
  /** Where paint may go at all: dry land, lakes as holes. Even-odd. */
  land: LngLatRings
  /**
   * The areas chosen for the hatch, each a polygon of rings (even-odd, so it may have holes); the
   * hatch covers their union, so overlaps are inked once. Absent: all of the land.
   */
  coverage?: readonly LngLatRings[]
}

type Edge = { x0: number; y0: number; x1: number; y1: number; minX: number; minY: number; maxY: number }

/** Areas projected once to Web Mercator's unit square (x east, y south), as edges. */
export interface PreparedHatchAreas {
  land: Edge[]
  coverage: { edges: Edge[]; bounds: number[] }[] | null
  bounds: [number, number, number, number]
}

const SAMPLES = 4

/** Longitude and latitude to Web Mercator's unit square. */
export function mercatorUnit(lng: number, lat: number): [number, number] {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const s = Math.sin((clamped * Math.PI) / 180)
  return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]
}

function edges(rings: LngLatRings, bounds: number[]): Edge[] {
  const out: Edge[] = []
  for (const ring of rings) {
    if (ring.length < 3) continue
    const points = ring.map(([lng, lat]) => mercatorUnit(lng, lat))
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i]
      const [x1, y1] = points[(i + 1) % points.length]
      bounds[0] = Math.min(bounds[0], x0)
      bounds[1] = Math.min(bounds[1], y0)
      bounds[2] = Math.max(bounds[2], x0)
      bounds[3] = Math.max(bounds[3], y0)
      if (y0 === y1) continue
      out.push({ x0, y0, x1, y1, minX: Math.min(x0, x1), minY: Math.min(y0, y1), maxY: Math.max(y0, y1) })
    }
  }
  return out
}

/** Projects the areas once; tiles are drawn from the result. */
export function prepareHatchAreas(areas: HatchTileAreas): PreparedHatchAreas {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity]
  const land = edges(areas.land, bounds)
  const coverageBounds = [Infinity, Infinity, -Infinity, -Infinity]
  const coverage = areas.coverage
    ? areas.coverage.map((polygon) => {
        const own = [Infinity, Infinity, -Infinity, -Infinity]
        const polygonEdges = edges(polygon, own)
        coverageBounds[0] = Math.min(coverageBounds[0], own[0])
        coverageBounds[1] = Math.min(coverageBounds[1], own[1])
        coverageBounds[2] = Math.max(coverageBounds[2], own[2])
        coverageBounds[3] = Math.max(coverageBounds[3], own[3])
        return { edges: polygonEdges, bounds: own }
      })
    : null
  const box = coverage
    ? [
        Math.max(bounds[0], coverageBounds[0]),
        Math.max(bounds[1], coverageBounds[1]),
        Math.min(bounds[2], coverageBounds[2]),
        Math.min(bounds[3], coverageBounds[3]),
      ]
    : bounds
  return { land, coverage, bounds: box as [number, number, number, number] }
}

/**
 * Even-odd sample mask of rings over a tile, OR-ed into `mask`. `scale` is pixels per unit-square
 * unit and (ox, oy) the tile's top-left in unit-square units.
 */
function areaMask(
  mask: Uint16Array,
  all: Edge[],
  width: number,
  height: number,
  ox: number,
  oy: number,
  scale: number,
): Uint16Array {
  const top = oy
  const bottom = oy + height / scale
  const right = ox + width / scale
  // Parity counts every crossing left of a sample, so edges left of the tile count too.
  const tileEdges = all.filter((e) => e.maxY >= top && e.minY <= bottom && e.minX <= right)
  if (!tileEdges.length) return mask
  const crossings: number[] = []
  for (let sy = 0; sy < height * SAMPLES; sy++) {
    const y = oy + (sy + 0.5) / SAMPLES / scale
    crossings.length = 0
    for (const e of tileEdges) {
      if (y < e.minY || y >= e.maxY) continue
      const t = (y - e.y0) / (e.y1 - e.y0)
      crossings.push(e.x0 + t * (e.x1 - e.x0))
    }
    if (!crossings.length) continue
    crossings.sort((a, b) => a - b)
    // Edges right of the tile are left out; an odd count means the last span runs off its right side.
    if (crossings.length % 2) crossings.push(Infinity)
    const py = Math.floor(sy / SAMPLES)
    const rowBit = (sy % SAMPLES) * SAMPLES
    // Even-odd: inside between the first and second crossing, the third and fourth…
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      // Samples whose centres fall between this crossing and the next.
      const from = Math.max(0, Math.ceil((crossings[k] - ox) * scale * SAMPLES - 0.5))
      const to = Math.min(width * SAMPLES - 1, Math.floor((crossings[k + 1] - ox) * scale * SAMPLES - 0.5))
      for (let sx = from; sx <= to; sx++) mask[py * width + (sx >> 2)] |= 1 << (rowBit + (sx & 3))
    }
  }
  return mask
}

export interface HatchTileOptions {
  /** CSS pixels a side of a map tile (MapLibre's source `tileSize`). Default 512. */
  tileSize?: number
  /** Device pixels per CSS pixel. Default 1. */
  pixelRatio?: number
}

/**
 * Tile (z, x, y) of the hatch: `recipe` anchored at `anchor` (longitude, latitude), its pattern
 * units CSS pixels at zoom z times `recipe.scale`. Null when the tile holds none of the areas.
 */
export function renderHatchTile(
  areas: PreparedHatchAreas,
  recipe: OrganicHatchRecipe,
  anchor: readonly [number, number],
  z: number,
  x: number,
  y: number,
  { tileSize = 512, pixelRatio = 1 }: HatchTileOptions = {},
): HatchRgbaImage | null {
  const tiles = 2 ** z
  const ox = x / tiles
  const oy = y / tiles
  const [bx0, by0, bx1, by1] = areas.bounds
  if (ox > bx1 || oy > by1 || ox + 1 / tiles < bx0 || oy + 1 / tiles < by0) return null
  const side = Math.round(tileSize * pixelRatio)
  const scale = tiles * side // device pixels per unit-square unit
  const clip = areaMask(new Uint16Array(side * side), areas.land, side, side, ox, oy, scale)
  if (areas.coverage) {
    const chosen = new Uint16Array(side * side)
    const x1 = ox + 1 / tiles
    const y1 = oy + 1 / tiles
    for (const polygon of areas.coverage) {
      const [px0, py0, px1, py1] = polygon.bounds
      if (px0 > x1 || py0 > y1 || px1 < ox || py1 < oy) continue
      areaMask(chosen, polygon.edges, side, side, ox, oy, scale)
    }
    for (let i = 0; i < clip.length; i++) clip[i] &= chosen[i]
  }
  if (!clip.some((bits) => bits !== 0)) return null
  // The field in CSS pixels of this zoom, origin at the anchor.
  const [ax, ay] = mercatorUnit(anchor[0], anchor[1])
  const world = tiles * tileSize
  const left = x * tileSize - ax * world
  const top = y * tileSize - ay * world
  const s = recipe.scale
  const strokes = recipeFieldStrokes(
    recipe,
    { x: left / s, y: top / s, width: tileSize / s, height: tileSize / s },
    { maxStrokes: Infinity },
  )
  const mask = new Uint16Array(side * side)
  const unitPx = pixelRatio * s
  coverHatchStrokes(mask, side, side, strokes, unitPx, -left * pixelRatio, -top * pixelRatio, false)
  return composeHatch(mask, side, side, recipe.color, recipe.opacity, undefined, clip)
}
