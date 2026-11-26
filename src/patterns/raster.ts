/**
 * Organic hatch strokes as RGBA pixels for an interactive map, where a pattern must be an image.
 * The recipe and its curves stay the source of truth: a screen tile is a preview of them, and a
 * print or vector export draws the curves themselves. Pure arithmetic with 4 × 4 supersampling,
 * so it runs in tests and workers alike. Crossing strokes are merged per sample, so the hatch
 * darkens nowhere twice, as an SVG group with one opacity. No DOM or network access.
 */
import {
  organicHatchStrokes,
  organicHatchTileStrokes,
  type HatchWindow,
  type OrganicHatchStroke,
} from './organic-hatch.js'
import { recipeHatchOptions, type OrganicHatchRecipe } from './recipe.js'

export interface HatchRgbaImage {
  width: number
  height: number
  /** Straight (not premultiplied) RGBA, row-major from the top-left. */
  data: Uint8ClampedArray
}

/** Largest side of a hatch tile or chunk, device pixels. */
export const MAX_HATCH_IMAGE_PX = 2048
const SAMPLES = 4
const SEGMENTS = 8

function rgb(color: string): [number, number, number] {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6)
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number]
}

function flatten(stroke: OrganicHatchStroke, scale: number, dx: number, dy: number): number[] {
  const points: number[] = []
  const { start: a, c1: b, c2: c, end: d } = stroke
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS
    const u = 1 - t
    const w0 = u * u * u,
      w1 = 3 * u * u * t,
      w2 = 3 * u * t * t,
      w3 = t * t * t
    points.push(
      (w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x) * scale + dx,
      (w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y) * scale + dy,
    )
  }
  return points
}

/**
 * Marks the samples each stroke covers in a per-pixel 16-bit sample mask. `scale` is pixels per
 * stroke unit and (dx, dy) the pixel position of the strokes' origin; `wrap` also draws every
 * stroke shifted by ± the image size, for a repeating tile.
 */
function coverStrokes(
  mask: Uint16Array,
  width: number,
  height: number,
  strokes: readonly OrganicHatchStroke[],
  scale: number,
  dx: number,
  dy: number,
  wrap: boolean,
) {
  const shifts = wrap
    ? [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => [i * width, j * height] as const))
    : [[0, 0] as const]
  for (const stroke of strokes) {
    const half = (stroke.width * scale) / 2
    for (const [sx, sy] of shifts) {
      const p = flatten(stroke, scale, dx + sx, dy + sy)
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (let i = 0; i < p.length; i += 2) {
        minX = Math.min(minX, p[i])
        maxX = Math.max(maxX, p[i])
        minY = Math.min(minY, p[i + 1])
        maxY = Math.max(maxY, p[i + 1])
      }
      const x0 = Math.max(0, Math.floor(minX - half)),
        x1 = Math.min(width - 1, Math.ceil(maxX + half))
      const y0 = Math.max(0, Math.floor(minY - half)),
        y1 = Math.min(height - 1, Math.ceil(maxY + half))
      if (x0 > x1 || y0 > y1) continue
      const h2 = half * half
      for (let py = y0; py <= y1; py++)
        for (let px = x0; px <= x1; px++) {
          let bits = mask[py * width + px]
          if (bits === 0xffff) continue
          for (let s = 0; s < SAMPLES * SAMPLES; s++) {
            if (bits & (1 << s)) continue
            const x = px + ((s % SAMPLES) + 0.5) / SAMPLES
            const y = py + (Math.floor(s / SAMPLES) + 0.5) / SAMPLES
            for (let i = 2; i < p.length; i += 2) {
              const ax = p[i - 2],
                ay = p[i - 1],
                vx = p[i] - ax,
                vy = p[i + 1] - ay
              const length = vx * vx + vy * vy
              const t = length ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / length)) : 0
              const ex = x - ax - vx * t,
                ey = y - ay - vy * t
              if (ex * ex + ey * ey <= h2) {
                bits |= 1 << s
                break
              }
            }
          }
          mask[py * width + px] = bits
        }
    }
  }
}

function popcount16(value: number) {
  value -= (value >> 1) & 0x5555
  value = (value & 0x3333) + ((value >> 2) & 0x3333)
  value = (value + (value >> 4)) & 0x0f0f
  return (value + (value >> 8)) & 0x1f
}

/** The hatch over an optional background, as straight-alpha pixels. */
function compose(
  mask: Uint16Array,
  width: number,
  height: number,
  color: string,
  opacity: number,
  background?: { color: string; opacity?: number },
): HatchRgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  const ink = rgb(color)
  const paper = background ? rgb(background.color) : ([0, 0, 0] as const)
  const paperAlpha = background ? (background.opacity ?? 1) : 0
  for (let i = 0; i < width * height; i++) {
    const a = (opacity * popcount16(mask[i])) / (SAMPLES * SAMPLES)
    const out = a + paperAlpha * (1 - a)
    if (out <= 0) continue
    for (let c = 0; c < 3; c++) data[i * 4 + c] = (ink[c] * a + paper[c] * paperAlpha * (1 - a)) / out
    data[i * 4 + 3] = out * 255
  }
  return { width, height, data }
}

export interface HatchRasterOptions {
  /** Device pixels per output unit: CSS pixels per point × device pixel ratio, say. */
  pixelsPerUnit: number
  /** Painted under the hatch; transparent when absent. */
  background?: { color: string; opacity?: number }
}

export interface HatchTile extends HatchRgbaImage {
  /** The tile's repeat, in output units. */
  period: { width: number; height: number }
}

/**
 * A tile that repeats seamlessly, about `targetPx` device pixels a side, for `fill-pattern`. The
 * field is blended with itself to repeat, so the waves are somewhat calmer than in an export; a
 * larger tile repeats less visibly. The tile is anchored at the field's origin.
 */
export function organicHatchTile(
  recipe: OrganicHatchRecipe,
  { pixelsPerUnit, background, targetPx = 512 }: HatchRasterOptions & { targetPx?: number },
): HatchTile {
  const unitPx = pixelsPerUnit * recipe.scale
  const side = Math.max(8, Math.min(MAX_HATCH_IMAGE_PX, Math.round(targetPx)))
  // Whole bands down and whole pixels both ways, so the tile meets itself exactly.
  const options = recipeHatchOptions(recipe)
  const rows = Math.max(1, Math.round(side / (options.bandHeight * unitPx)))
  const height = Math.max(1, Math.round(rows * options.bandHeight * unitPx))
  const width = side
  const tile = organicHatchTileStrokes(options, { width: width / unitPx, height: height / unitPx })
  const mask = new Uint16Array(width * height)
  coverStrokes(mask, width, height, tile.strokes, unitPx, 0, 0, true)
  return {
    ...compose(mask, width, height, recipe.color, recipe.opacity, background),
    period: { width: width / pixelsPerUnit, height: height / pixelsPerUnit },
  }
}

/**
 * One chunk of the open field, as drawn in an export: `window` in output units, at
 * `pixelsPerUnit`. Chunks from the same recipe meet without seams, so a map can cache them and
 * reveal more of the same field as it pans.
 */
export function organicHatchChunk(
  recipe: OrganicHatchRecipe,
  window: HatchWindow,
  { pixelsPerUnit, background }: HatchRasterOptions,
): HatchRgbaImage {
  const width = Math.max(1, Math.round(window.width * pixelsPerUnit))
  const height = Math.max(1, Math.round(window.height * pixelsPerUnit))
  if (width > MAX_HATCH_IMAGE_PX || height > MAX_HATCH_IMAGE_PX)
    throw new RangeError(
      `A hatch chunk is at most ${MAX_HATCH_IMAGE_PX} pixels a side; this one is ${width} × ${height}.`,
    )
  const [ox, oy] = recipe.origin
  const s = recipe.scale
  const { strokes } = organicHatchStrokes(
    { x: (window.x - ox) / s, y: (window.y - oy) / s, width: window.width / s, height: window.height / s },
    recipeHatchOptions(recipe),
  )
  const mask = new Uint16Array(width * height)
  const unitPx = pixelsPerUnit * s
  coverStrokes(
    mask,
    width,
    height,
    strokes,
    unitPx,
    (ox - window.x) * pixelsPerUnit,
    (oy - window.y) * pixelsPerUnit,
    false,
  )
  return compose(mask, width, height, recipe.color, recipe.opacity, background)
}
