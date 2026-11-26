/**
 * Patch hatching: the texture of a hand-hatched map drawn patch by patch. The plane is tiled with
 * irregular patches whose seams bend; inside each patch, short strokes stand on rows that arc like
 * stacked hillsides, each stroke square to its row, and the whole patch leans its own way. Where
 * two patches meet, their rows do not line up and a thin white seam is left between them. This is
 * how the northern hatch of the Rainforest to Rockies map (brand guidelines, page 8) reads: strokes
 * about 3 px apart and 8–9 px long, 1.2 px wide, bands about 10 px, a third of the area inked,
 * leaning a median 6° and up to about 27° from vertical, more often to the right.
 *
 * Every patch is generated on its own from the seed and its lattice position, and a stroke is kept
 * only by the patch that owns all of it, so any window of the field, anywhere, draws exactly the
 * strokes a larger window draws there. No DOM or network access.
 */
import {
  formatHatchNumber,
  organicHatchStrokePath,
  type HatchWindow,
  type OrganicHatchStroke,
} from './organic-hatch.js'

export type PatchHatchOptions = {
  seed: number
  /** Distance between neighbouring strokes along a row. */
  spacing: number
  /** Height of one row of strokes; a stroke fills about 85% of it. */
  bandHeight: number
  strokeWidth: number
  /** How far a patch's rows sag at its sides, as a share of the band height × 4; 0 is flat. */
  curvature: number
  /** The average width of a patch; patches are about half as tall. */
  patchSize: number
  /** The largest lean of a patch from vertical, degrees; most patches lean far less. */
  lean: number
  /** A lean every patch shares, degrees; positive leans the strokes' tops to the right. */
  leanBias: number
  /** The white gap left between patches. */
  seam: number
}

export const PATCH_HATCH_GENERATOR = 'patch-hatch-v1'

/** Fitted to the page 8 reference at its 1536 px width. */
export const DEFAULT_PATCH_HATCH: Readonly<PatchHatchOptions> = Object.freeze({
  seed: 8,
  spacing: 3,
  bandHeight: 11,
  strokeWidth: 1.45,
  curvature: 16,
  patchSize: 300,
  lean: 30,
  leanBias: 5,
  seam: 0,
})

export const PATCH_HATCH_LIMITS = Object.freeze({
  seed: { min: 0, max: 999_999 },
  spacing: { min: 1.5, max: 12 },
  bandHeight: { min: 5, max: 40 },
  strokeWidth: { min: 0.3, max: 2.4 },
  curvature: { min: 0, max: 24 },
  patchSize: { min: 20, max: 400 },
  lean: { min: 0, max: 60 },
  leanBias: { min: -30, max: 30 },
  seam: { min: 0, max: 6 },
})

/** Most strokes one `patchHatchStrokes` call makes before it refuses the window. */
export const DEFAULT_MAX_PATCH_STROKES = 250_000

const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback

/** Options with every value present and clamped into `PATCH_HATCH_LIMITS`. */
export function readPatchHatchOptions(input: Partial<PatchHatchOptions> = {}): PatchHatchOptions {
  const out = {} as PatchHatchOptions
  for (const key of Object.keys(PATCH_HATCH_LIMITS) as (keyof PatchHatchOptions)[]) {
    const { min, max } = PATCH_HATCH_LIMITS[key]
    out[key] = bounded(input[key], DEFAULT_PATCH_HATCH[key], min, max)
  }
  out.seed = Math.trunc(out.seed)
  return out
}

function randomAt(seed: number, a: number, b: number, channel: number): number {
  let h = (seed + 0x632be5ab) ^ Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77)
  h ^= Math.imul(channel + 1, 0xc2b2ae3d)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000
}

const mod = (value: number, period: number) => ((value % period) + period) % period
const smooth = (t: number) => t * t * (3 - 2 * t)

type Patch = { i: number; j: number; x: number; y: number }
type Bounds = { x0: number; y0: number; x1: number; y1: number }

/** A repeat, in whole lattice cells, for a seamless tile. */
type Period = { columns: number; rows: number }

function makeField(options: PatchHatchOptions, period?: Period) {
  const { seed, patchSize } = options
  const cellW = patchSize
  const cellH = patchSize * 0.5
  const rand = (a: number, b: number, channel: number) => randomAt(seed, a, b, channel)
  const wrapI = (i: number) => (period ? mod(i, period.columns) : i)
  const wrapJ = (j: number) => (period ? mod(j, period.rows) : j)

  /** Smooth value noise on a lattice `size` across, wrapping with the period when there is one. */
  function noise(x: number, y: number, size: number, channel: number) {
    const gx = x / size
    const gy = y / size
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    const tx = smooth(gx - ix)
    const ty = smooth(gy - iy)
    // With a period the lattice must divide it: the warp lattice is one patch cell.
    const wx = (i: number) => (period ? mod(i, period.columns) : i)
    const wy = (j: number) => (period ? mod(j, period.rows) : j)
    const a = rand(wx(ix), wy(iy), channel)
    const b = rand(wx(ix + 1), wy(iy), channel)
    const c = rand(wx(ix), wy(iy + 1), channel)
    const d = rand(wx(ix + 1), wy(iy + 1), channel)
    return 2 * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty) - 1
  }

  /** Where a point is looked up: shifted by a slow warp, so the seams between patches bend. */
  function warped(x: number, y: number): [number, number] {
    // One warp cell per patch cell, so a repeating tile wraps it exactly.
    const n1 = noise(x / cellW, y / cellH, 1, 11)
    const n2 = noise(x / cellW, y / cellH, 1, 12)
    return [x + 0.32 * cellW * n1, y + 0.32 * cellH * n2]
  }

  const sites = new Map<number, Patch>()
  function site(i: number, j: number): Patch {
    const key = i * 1_048_576 + j
    const cached = sites.get(key)
    if (cached) return cached
    if (sites.size > 50_000) sites.clear()
    const made = makeSite(i, j)
    sites.set(key, made)
    return made
  }
  function makeSite(i: number, j: number): Patch {
    const si = wrapI(i)
    const sj = wrapJ(j)
    return {
      i,
      j,
      x: (i + 0.5 + 0.7 * (rand(si, sj, 1) - 0.5) + (mod(sj, 2) ? 0.5 : 0)) * cellW,
      y: (j + 0.5 + 0.6 * (rand(si, sj, 2) - 0.5)) * cellH,
    }
  }

  /**
   * The patch owning a point and how far the point is from that patch's seam, both measured in a
   * space squeezed so patches are as wide as tall.
   */
  function owner(x: number, y: number): { patch: Patch; seam: number } {
    const [wx, wy] = warped(x, y)
    const ci = Math.floor(wx / cellW)
    const cj = Math.floor(wy / cellH)
    let best: Patch | null = null
    let second: Patch | null = null
    let d1 = Infinity
    let d2 = Infinity
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        const s = site(ci + di, cj + dj)
        const dx = (wx - s.x) / cellW
        const dy = (wy - s.y) / cellH
        const d = dx * dx + dy * dy
        if (d < d1) {
          d2 = d1
          second = best
          d1 = d
          best = s
        } else if (d < d2) {
          d2 = d
          second = s
        }
      }
    // Distance to the bisector between the two nearest sites, back in point units.
    const sx = (second!.x - best!.x) / cellW
    const sy = (second!.y - best!.y) / cellH
    const gap = (d2 - d1) / (2 * Math.hypot(sx, sy))
    return { patch: best!, seam: gap * Math.min(cellW, cellH) }
  }

  /**
   * Every stroke a patch owns, in field coordinates. Its rows are stacked ribbons: one smooth
   * displacement shared by all of them, so neighbouring rows wave together and never cross. Each
   * stroke spans its band from one ribbon edge to the next, square to the ribbon, so it leans
   * where the ribbon slopes.
   */
  function patchStrokes(patch: Patch, emit: (stroke: OrganicHatchStroke) => void, bounds?: Bounds) {
    const si = wrapI(patch.i)
    const sj = wrapJ(patch.j)
    const r = (channel: number) => rand(si, sj, channel)
    // Neighbouring patches lean alike (a slow field) with their own variation: mostly small
    // leans, a few strong ones, biased one way, the reference's spread.
    let drift = 0
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++)
        drift += (di || dj ? 1 : 2) * (2 * rand(wrapI(patch.i + di), wrapJ(patch.j + dj), 13) - 1)
    drift = Math.max(-1, Math.min(1, (drift / 10) * 2.4))
    const u = 2 * r(3) - 1
    const lean =
      ((options.leanBias + options.lean * (0.55 * drift * Math.abs(drift) + 0.45 * u * u * u)) * Math.PI) / 180
    const cos = Math.cos(lean)
    const sin = Math.sin(lean)
    const band = options.bandHeight * (0.88 + 0.24 * r(4))
    const scale = band / 10
    const half = cellW * 0.9
    const sag = (r(5) < 0.75 ? 1 : -1) * options.curvature * 0.6 * (0.3 + 0.7 * r(6)) * scale
    const centre = (r(7) - 0.5) * cellW * 0.6
    const phase = r(8) * band
    // The ribbons' wave: every 45–75 units across, by about the curvature, changing slowly
    // down the patch so the rows stay roughly parallel.
    const amplitude = options.curvature * (0.5 + r(9)) * scale
    const across = 34 * (0.8 + 0.5 * r(10)) * scale
    // Slow down the stack, so a band never stretches or squeezes by more than about a fifth.
    const down = 120 * (0.8 + 0.5 * r(11)) * scale
    const lattice = (a: number, b: number) => rand(si * 977 + a, sj * 983 + b, 300)
    const displacement = (pu: number, pv: number) => {
      const gx = pu / across + 64
      const gy = pv / down + 64
      const ix = Math.floor(gx)
      const iy = Math.floor(gy)
      const tx = smooth(gx - ix)
      const ty = smooth(gy - iy)
      const a = lattice(ix, iy),
        b = lattice(ix + 1, iy),
        c = lattice(ix, iy + 1),
        d = lattice(ix + 1, iy + 1)
      const wave = 2 * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty) - 1
      return amplitude * wave + sag * ((pu - centre) / half) ** 2
    }
    /** A point of the ribbons: across `pu`, `pv` down the undisplaced stack. */
    const ribbon = (pu: number, pv: number) => pv + displacement(pu, pv)
    const safeWidth = Math.min(options.strokeWidth, options.spacing * 0.6)
    // A patch can stretch 1.5 cells from its site once warped; rotated, either extent can lie
    // across the rows, so both reaches cover the larger.
    const reachU = cellW * 1.6 + cellH * Math.abs(sin)
    const reachV = cellH * 1.6 + cellW * Math.abs(sin) + Math.abs(sag) + amplitude
    const firstRow = Math.floor((-reachV - phase) / band)
    const lastRow = Math.ceil((reachV - phase) / band)
    const toWorld = (pu: number, py: number) => ({
      x: patch.x + pu * cos - py * sin,
      y: patch.y + pu * sin + py * cos,
    })
    // Rows are independent, so those that cannot reach the window are not walked. A row's strokes
    // lie within the wave, the sag and a band of its level, across the rotated window.
    let vMin = -Infinity
    let vMax = Infinity
    if (bounds) {
      const corners = [
        [bounds.x0, bounds.y0],
        [bounds.x1, bounds.y0],
        [bounds.x0, bounds.y1],
        [bounds.x1, bounds.y1],
      ].map(([x, y]) => -(x - patch.x) * sin + (y - patch.y) * cos)
      const slack = amplitude + Math.abs(sag) * 4 + band * 2
      vMin = Math.min(...corners) - slack
      vMax = Math.max(...corners) + slack
    }
    const pad = band * 2
    for (let row = firstRow; row <= lastRow; row++) {
      const level = phase + row * band
      if (level < vMin || level > vMax) continue
      let column = 0
      let pu = -reachU + rand(si * 31 + 7, sj * 37 + mod(row, 997), 40) * options.spacing
      while (pu < reachU) {
        const rc = (channel: number) => rand(si * 4099 + column, sj * 4111 + row, channel)
        const middle = level + band / 2
        // Most of the rows a patch walks lie in its neighbours: a stroke whose anchor sits deep
        // inside another patch cannot reach this one, so skip it before drawing it.
        const anchor = toWorld(pu, ribbon(pu, middle))
        const outside =
          bounds &&
          (anchor.x < bounds.x0 - pad ||
            anchor.x > bounds.x1 + pad ||
            anchor.y < bounds.y0 - pad ||
            anchor.y > bounds.y1 + pad)
        const found = outside ? null : owner(anchor.x, anchor.y)
        if (!found) {
          pu +=
            (options.spacing * (0.82 + 0.36 * rc(5))) /
            Math.hypot(ribbon(pu + 0.5, middle) - ribbon(pu - 0.5, middle), 1)
          column++
          continue
        }
        if ((found.patch.i !== patch.i || found.patch.j !== patch.j) && found.seam > band) {
          pu +=
            (options.spacing * (0.82 + 0.36 * rc(5))) /
            Math.hypot(ribbon(pu + 0.5, middle) - ribbon(pu - 0.5, middle), 1)
          column++
          continue
        }
        const slope = (ribbon(pu + 0.5, middle) - ribbon(pu - 0.5, middle)) / 1
        const norm = Math.hypot(slope, 1)
        const top = band * (0.09 + 0.08 * rc(1))
        const bottom = band * (0.78 + 0.09 * rc(2))
        const bend = (rc(3) - 0.5) * band * 0.12
        // Down the band from one ribbon edge towards the next, stepping across against the
        // slope so the stroke stands square to the ribbon.
        const at = (t: number) => {
          const pv = level + top + (bottom - top) * t
          const shift = (-slope * (pv - middle)) / (norm * norm) + bend * 4 * t * (1 - t)
          const x = pu + shift
          return toWorld(x, ribbon(x, pv))
        }
        const start = at(0)
        const p1 = at(1 / 3)
        const p2 = at(2 / 3)
        const end = at(1)
        const c1 = {
          x: (54 * p1.x - 27 * p2.x - 15 * start.x + 6 * end.x) / 18,
          y: (54 * p1.y - 27 * p2.y - 15 * start.y + 6 * end.y) / 18,
        }
        const c2 = {
          x: (54 * p2.x - 27 * p1.x + 6 * start.x - 15 * end.x) / 18,
          y: (54 * p2.y - 27 * p1.y + 6 * start.y - 15 * end.y) / 18,
        }
        emit({ start, c1, c2, end, width: safeWidth * (0.8 + 0.4 * rc(4)) })
        pu += (options.spacing * (0.82 + 0.36 * rc(5))) / norm
        column++
      }
    }
  }
  /**
   * The part of a stroke `patch` keeps: its longest run in the patch and clear of the seam, as its
   * own cubic, or null when too little is left. Strokes are cut at the seam, as a hand cuts them,
   * not dropped whole.
   */
  function clipped(patch: Patch, stroke: OrganicHatchStroke): OrganicHatchStroke | null {
    const margin = options.seam > 0 ? options.seam / 2 + stroke.width / 2 : 0
    const inside = (t: number) => {
      const p = cubicAt(stroke, t)
      const found = owner(p.x, p.y)
      return found.patch.i === patch.i && found.patch.j === patch.j && found.seam >= margin
    }
    // Most strokes lie wholly in one patch: both ends and the middle inside, well clear of a seam.
    const ends = [0, 0.5, 1].map((t) => {
      const p = cubicAt(stroke, t)
      return owner(p.x, p.y)
    })
    const length = Math.hypot(stroke.end.x - stroke.start.x, stroke.end.y - stroke.start.y)
    const mine = ends.map((found) => found.patch.i === patch.i && found.patch.j === patch.j)
    if (mine.every(Boolean) && ends.every((found) => found.seam >= margin + length / 2)) return stroke
    if (!mine.some(Boolean) && ends.every((found) => found.seam > length)) return null
    // The longest run of samples inside the patch, wherever it falls: a seam across a band
    // leaves each patch the part of the stroke on its side.
    const samples = 2 * CLIP_STEPS
    let t0 = 0
    let t1 = -1
    let runStart = -1
    for (let k = 0; k <= samples; k++) {
      if (inside(k / samples)) {
        if (runStart < 0) runStart = k
        if ((k - runStart) / samples > t1 - t0) {
          t0 = runStart / samples
          t1 = k / samples
        }
      } else runStart = -1
    }
    if (t1 - t0 < MIN_KEPT) return null
    return t0 === 0 && t1 === 1 ? stroke : { ...subCubic(stroke, t0, t1), width: stroke.width }
  }

  return { cellW, cellH, site, owner, patchStrokes, clipped }
}

/** About how many strokes a window holds. */
export function estimatePatchHatchStrokes(window: HatchWindow, input: Partial<PatchHatchOptions> = {}): number {
  const options = readPatchHatchOptions(input)
  if (!(window.width > 0) || !(window.height > 0)) return 0
  return Math.ceil(((window.width + 2) * (window.height + 2)) / (options.bandHeight * options.spacing))
}

/** Samples each half of a stroke is tested at, for clipping it at a seam. */
const CLIP_STEPS = 6
/** The least share of a stroke worth keeping after clipping. */
const MIN_KEPT = 0.25

type Point = { x: number; y: number }
function cubicAt({ start: a, c1: b, c2: c, end: d }: OrganicHatchStroke, t: number): Point {
  const u = 1 - t
  const w0 = u * u * u,
    w1 = 3 * u * u * t,
    w2 = 3 * u * t * t,
    w3 = t * t * t
  return { x: w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x, y: w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y }
}
/** The piece of a cubic between t0 and t1, as a cubic (de Casteljau). */
function subCubic(stroke: OrganicHatchStroke, t0: number, t1: number) {
  const lerp = (p: Point, q: Point, t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const split = (a: Point, b: Point, c: Point, d: Point, t: number) => {
    const ab = lerp(a, b, t),
      bc = lerp(b, c, t),
      cd = lerp(c, d, t)
    const abc = lerp(ab, bc, t),
      bcd = lerp(bc, cd, t)
    const m = lerp(abc, bcd, t)
    return { left: [a, ab, abc, m], right: [m, bcd, cd, d] }
  }
  const tail = split(stroke.start, stroke.c1, stroke.c2, stroke.end, t0).right
  const piece = split(tail[0], tail[1], tail[2], tail[3], t0 < 1 ? (t1 - t0) / (1 - t0) : 0).left
  return { start: piece[0], c1: piece[1], c2: piece[2], end: piece[3] }
}

const meets = (stroke: OrganicHatchStroke, x0: number, y0: number, x1: number, y1: number) => {
  const half = stroke.width / 2
  const xs = [stroke.start.x, stroke.c1.x, stroke.c2.x, stroke.end.x]
  const ys = [stroke.start.y, stroke.c1.y, stroke.c2.y, stroke.end.y]
  return (
    Math.max(...xs) + half >= x0 &&
    Math.min(...xs) - half <= x1 &&
    Math.max(...ys) + half >= y0 &&
    Math.min(...ys) - half <= y1
  )
}

/**
 * The strokes of the patch field meeting `window`, in field coordinates. Exactly the spacing asked
 * for, whatever the window; a window estimated past `maxStrokes` is refused with a RangeError.
 */
export function patchHatchStrokes(
  window: HatchWindow,
  input: Partial<PatchHatchOptions> = {},
  { maxStrokes = DEFAULT_MAX_PATCH_STROKES }: { maxStrokes?: number } = {},
): { strokes: OrganicHatchStroke[]; options: PatchHatchOptions } {
  const options = readPatchHatchOptions(input)
  if (
    ![window.x, window.y, window.width, window.height].every(Number.isFinite) ||
    window.width <= 0 ||
    window.height <= 0
  )
    return { strokes: [], options }
  const estimate = estimatePatchHatchStrokes(window, options)
  if (estimate > maxStrokes)
    throw new RangeError(
      `This hatch window holds about ${estimate} strokes, over the limit of ${maxStrokes}. Split the window or widen the spacing.`,
    )
  const field = makeField(options)
  const x0 = window.x
  const y0 = window.y
  const x1 = window.x + window.width
  const y1 = window.y + window.height
  const strokes: OrganicHatchStroke[] = []
  // A patch reaches about 1.5 cells from its lattice cell once jittered and warped.
  const i0 = Math.floor(x0 / field.cellW) - 2
  const i1 = Math.floor(x1 / field.cellW) + 2
  const j0 = Math.floor(y0 / field.cellH) - 2
  const j1 = Math.floor(y1 / field.cellH) + 2
  const bounds = { x0, y0, x1, y1 }
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const patch = field.site(i, j)
      field.patchStrokes(
        patch,
        (stroke) => {
          if (!meets(stroke, x0, y0, x1, y1)) return
          const kept = field.clipped(patch, stroke)
          if (kept) strokes.push(kept)
        },
        bounds,
      )
    }
  return { strokes, options }
}

/**
 * Strokes for a tile that repeats every `columns` × `rows` patch cells, as `patchHatchStrokes`
 * draws the open field: the patch lattice and its warp wrap, so nothing is blended. Each stroke is
 * listed once, by where its middle falls; draw it shifted by ± the tile size as well to wrap it.
 */
export function patchHatchTileStrokes(
  input: Partial<PatchHatchOptions>,
  { columns, rows }: Period,
): { strokes: OrganicHatchStroke[]; width: number; height: number } {
  const options = readPatchHatchOptions(input)
  const period = {
    columns: Math.max(2, Math.round(columns)),
    rows: Math.max(2, Math.round(rows) + (Math.round(rows) % 2)),
  }
  const field = makeField(options, period)
  const width = period.columns * field.cellW
  const height = period.rows * field.cellH
  const strokes: OrganicHatchStroke[] = []
  for (let j = -1; j <= period.rows; j++)
    for (let i = -1; i <= period.columns; i++) {
      const patch = field.site(i, j)
      field.patchStrokes(patch, (stroke) => {
        const mx = (stroke.start.x + stroke.end.x) / 2
        const my = (stroke.start.y + stroke.end.y) / 2
        if (mx < 0 || mx >= width || my < 0 || my >= height) return
        const kept = field.clipped(patch, stroke)
        if (kept) strokes.push(kept)
      })
    }
  return { strokes, width, height }
}

/**
 * The patch field over a `width` × `height` artboard as one colour-inheriting SVG group of
 * individually editable strokes, origin (0,0), for the caller to clip. Records its generator, seed
 * and stroke count. Its density is always the asked spacing; past `maxStrokes` it throws.
 */
export function patchHatchSvgGroup(
  width: number,
  height: number,
  input: Partial<PatchHatchOptions> = {},
  limits?: { maxStrokes?: number },
): string {
  const options = readPatchHatchOptions(input)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    return `<g data-generator="${PATCH_HATCH_GENERATOR}" data-stroke-count="0"/>`
  const { strokes } = patchHatchStrokes({ x: 0, y: 0, width, height }, options, limits)
  const n = formatHatchNumber
  const paths = strokes.map(
    (stroke) => `<path d="${organicHatchStrokePath(stroke)}" stroke-width="${n(stroke.width)}"/>`,
  )
  return (
    `<g data-generator="${PATCH_HATCH_GENERATOR}" data-seed="${options.seed}" data-stroke-count="${paths.length}" ` +
    `data-spacing="${n(options.spacing)}" data-patch-size="${n(options.patchSize)}" ` +
    `fill="none" stroke="currentColor" stroke-linecap="round">\n${paths.join('\n')}\n</g>`
  )
}
