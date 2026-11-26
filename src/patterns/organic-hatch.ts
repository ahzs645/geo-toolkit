/**
 * Organic hatching: short cubic strokes that follow locally varying contour bands, the texture of
 * a hand-hatched illustrated map. The field is a pure function of position and seed, so any window
 * of it can be generated on its own and still meet its neighbours: two windows that share the
 * field's origin draw the same strokes where they overlap.
 *
 * Marks follow a band's local normal with a small independent bend. Anchors are spaced along the
 * contour, avoiding the slanted density corridors produced by fixed x-columns and an unrelated lean
 * field. Row-specific offsets and varied endpoints keep the seams imperfect without removing their
 * local organization.
 *
 * Research: https://www.tylerxhobbs.com/words/flow-fields and Jobard/Lefer's evenly spaced
 * streamlines. No external drawing code or source marks are used. No DOM or network access.
 */

/** The five numbers that reproduce a hatch exactly. Lengths are in pattern units. */
export type OrganicHatchOptions = {
  seed: number
  /** Distance between neighbouring strokes along a band. */
  spacing: number
  /** Height of one band of strokes: the length of a stroke, roughly. */
  bandHeight: number
  strokeWidth: number
  /** How far the bands wave and the strokes bend; 0 is straight. */
  curvature: number
}

/** The generator's name and version, written into every SVG it makes. */
export const ORGANIC_HATCH_GENERATOR = 'contour-hatch-v3'

export const DEFAULT_ORGANIC_HATCH: Readonly<OrganicHatchOptions> = Object.freeze({
  seed: 8,
  spacing: 3,
  bandHeight: 14,
  strokeWidth: 1.55,
  curvature: 8,
})

/** The range of each option. A saved recipe outside it is refused; loose input is clamped into it. */
export const ORGANIC_HATCH_LIMITS = Object.freeze({
  seed: { min: 0, max: 999_999 },
  spacing: { min: 1.5, max: 12 },
  bandHeight: { min: 8, max: 40 },
  strokeWidth: { min: 0.3, max: 2.4 },
  curvature: { min: 0, max: 24 },
})

/** Strokes start this far left of the field's origin, so the first column is not ragged. */
export const ORGANIC_HATCH_LEFT_PADDING = 70
const MAX_SVG_STROKES = 30_000
const MAX_SVG_DIMENSION = 4096
/** Most strokes one `organicHatchStrokes` call makes before it refuses the window. */
export const DEFAULT_MAX_WINDOW_STROKES = 250_000

export type HatchPoint = { x: number; y: number }
/** One cubic stroke: start, two controls, end, and its width, all in pattern units. */
export type OrganicHatchStroke = { start: HatchPoint; c1: HatchPoint; c2: HatchPoint; end: HatchPoint; width: number }
export type HatchWindow = { x: number; y: number; width: number; height: number }

function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

/** Options with every value present and clamped into `ORGANIC_HATCH_LIMITS`. */
export function readOrganicHatchOptions(input: Partial<OrganicHatchOptions> = {}): OrganicHatchOptions {
  const L = ORGANIC_HATCH_LIMITS
  const D = DEFAULT_ORGANIC_HATCH
  return {
    seed: Math.trunc(bounded(input.seed, D.seed, L.seed.min, L.seed.max)),
    spacing: bounded(input.spacing, D.spacing, L.spacing.min, L.spacing.max),
    bandHeight: bounded(input.bandHeight, D.bandHeight, L.bandHeight.min, L.bandHeight.max),
    strokeWidth: bounded(input.strokeWidth, D.strokeWidth, L.strokeWidth.min, L.strokeWidth.max),
    curvature: bounded(input.curvature, D.curvature, L.curvature.min, L.curvature.max),
  }
}

/** Counter-based randomness keeps existing marks stable when an artboard grows. */
function randomAt(seed: number, row: number, column: number, channel: number): number {
  let h = seed ^ Math.imul(row, 0x9e3779b1) ^ Math.imul(column, 0x85ebca77)
  h ^= Math.imul(channel + 1, 0xc2b2ae3d)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000
}

const mod = (value: number, period: number) => ((value % period) + period) % period

type FieldSample = { value: number; dx: number; dv: number }
type Field = (x: number, v: number) => FieldSample
type Period = { width: number; height: number; rows: number }

/**
 * A field made to repeat every `width` × `height`: four shifted copies of it blended with
 * smoothstep weights, which meet with matching value and slope at the edges. Used only for
 * repeating tiles; the open field is never blended.
 */
function periodic(field: Field, { width, height }: Period): Field {
  return (x, v) => {
    const px = mod(x, width)
    const pv = mod(v, height)
    const tx = px / width
    const tv = pv / height
    const sx = tx * tx * (3 - 2 * tx)
    const sv = tv * tv * (3 - 2 * tv)
    const dsx = (6 * tx * (1 - tx)) / width
    const dsv = (6 * tv * (1 - tv)) / height
    const a = field(px, pv)
    const b = field(px - width, pv)
    const c = field(px, pv - height)
    const d = field(px - width, pv - height)
    const wa = (1 - sx) * (1 - sv)
    const wb = sx * (1 - sv)
    const wc = (1 - sx) * sv
    const wd = sx * sv
    return {
      value: wa * a.value + wb * b.value + wc * c.value + wd * d.value,
      dx:
        wa * a.dx +
        wb * b.dx +
        wc * c.dx +
        wd * d.dx +
        dsx * ((1 - sv) * (b.value - a.value) + sv * (d.value - c.value)),
      dv:
        wa * a.dv +
        wb * b.dv +
        wc * c.dv +
        wd * d.dv +
        dsv * ((1 - sx) * (c.value - a.value) + sx * (d.value - b.value)),
    }
  }
}

function makeStrokeField(options: OrganicHatchOptions, period?: Period) {
  const { seed, curvature, bandHeight } = options
  const rand = (row: number, column: number, channel: number) => randomAt(seed, row, column, channel)
  const strength = (1.5 * curvature) / (4 + curvature)
  const verticalScale = Math.max(1, strength)
  const rowStrength = Math.min(1, strength) * 0.22
  const detailStrength = Math.min(curvature, 16) / 8

  function noise(x: number, y: number, channel: number): FieldSample {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const tx = x - ix
    const ty = y - iy
    const wx = tx * tx * (3 - 2 * tx)
    const wy = ty * ty * (3 - 2 * ty)
    const a = rand(iy, ix, channel)
    const b = rand(iy, ix + 1, channel)
    const c = rand(iy + 1, ix, channel)
    const d = rand(iy + 1, ix + 1, channel)
    const top = a + (b - a) * wx
    const bottom = c + (d - c) * wx
    return {
      value: 2 * (top + (bottom - top) * wy) - 1,
      dx: 2 * ((b - a) * (1 - wy) + (d - c) * wy) * 6 * tx * (1 - tx),
      dv: 2 * (bottom - top) * 6 * ty * (1 - ty),
    }
  }

  function field(lx: number, lv: number, angle: number, channel: number): Field {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const open: Field = (x, v) => {
      // Rotating each lattice prevents derivative-zero rails at shared x knots.
      const sample = noise(
        (cos * x) / lx + (sin * v) / lv + channel * 0.276,
        (-sin * x) / lx + (cos * v) / lv + channel * 0.183,
        channel,
      )
      return {
        value: sample.value,
        dx: (cos * sample.dx - sin * sample.dv) / lx,
        dv: (sin * sample.dx + cos * sample.dv) / lv,
      }
    }
    return period ? periodic(open, period) : open
  }

  const fine = field(24, 60 * verticalScale, 0.41, 40)
  const finer = field(12, 45 * verticalScale, -0.63, 41)
  const broad = field(85, 400 * verticalScale, 0.76, 43)
  const leanField = field(30, 28, 0.83, 55)
  const bendField = field(21, 35, -0.38, 56)

  function rowOffset(x: number, row: number) {
    const key = period ? mod(row, period.rows) : row
    let pitch = 30 + rand(key, 0, 71) * 28
    // A repeating tile holds a whole number of offset cells across.
    const cells = period ? Math.max(1, Math.round(period.width / pitch)) : 0
    if (period) pitch = period.width / cells
    const position = x / pitch + rand(key, 0, 70) * 10
    const cell = Math.floor(position)
    const t = position - cell
    const a = rand(key, period ? mod(cell, cells) : cell, 72)
    const b = rand(key, period ? mod(cell + 1, cells) : cell + 1, 72)
    return {
      value: 2 * (a + (b - a) * t * t * (3 - 2 * t)) - 1,
      dx: (2 * (b - a) * 6 * t * (1 - t)) / pitch,
    }
  }

  function surface(x: number, v: number) {
    const p = fine(x, v)
    const q = finer(x, v)
    const m = broad(x, v)
    const row = Math.floor(v / bandHeight)
    const t = v / bandHeight - row
    const a = rowOffset(x, row)
    const b = rowOffset(x, row + 1)
    return {
      y:
        v +
        strength * (3 * p.value + 1.5 * q.value + 14 * m.value) +
        bandHeight * rowStrength * (a.value * (1 - t) + b.value * t),
      dx: strength * (3 * p.dx + 1.5 * q.dx + 14 * m.dx) + bandHeight * rowStrength * (a.dx * (1 - t) + b.dx * t),
      dv: 1 + strength * (3 * p.dv + 1.5 * q.dv + 14 * m.dv) + rowStrength * (b.value - a.value),
    }
  }

  // The rotated value-noise derivative bounds give surface.dv > 0.07 for
  // every permitted setting and seed. Increasing strong curvature also extends
  // its vertical wavelengths, so the contour bands cannot exchange order.
  function velocity(x: number, v: number): number {
    const { dx, dv } = surface(x, v)
    return (-dx * dv) / (1 + dx * dx)
  }

  function integrate(x: number, v: number, distance: number): number {
    const steps = Math.max(1, Math.ceil(Math.abs(distance) / 3))
    const step = distance / steps
    for (let i = 0; i < steps; i += 1) {
      const a = velocity(x, v)
      const b = velocity(x + (a * step) / 2, v + step / 2)
      const c = velocity(x + (b * step) / 2, v + step / 2)
      const d = velocity(x + c * step, v + step)
      x += (step * (a + 2 * b + 2 * c + d)) / 6
      v += step
    }
    return x
  }

  function stroke(row: number, column: number, x: number): Omit<OrganicHatchStroke, 'width'> {
    const middle = (row + 0.5) * bandHeight
    const v0 = (row + 0.095 * (0.4 + 1.2 * rand(row, column, 4))) * bandHeight
    const v3 = (row + 1 - 0.095 * (0.4 + 1.2 * rand(row, column, 5))) * bandHeight
    const lean = leanField(x, middle).value * 2.2 * detailStrength
    const bend = bendField(x, middle).value * 2 * detailStrength
    const pointsAt = (amount: number): HatchPoint[] =>
      [0, 1 / 3, 2 / 3, 1].map((t) => {
        const v = v0 + (v3 - v0) * t
        const xx = integrate(x, middle, v - middle) + amount * (lean * (t - 0.5) + bend * 4 * t * (1 - t))
        return { x: xx, y: surface(xx, v).y }
      })
    let amount = 1
    let points = pointsAt(amount)
    while (points[3].y - points[0].y < bandHeight * 0.03 && amount > 0.03) {
      amount *= 0.5
      points = pointsAt(amount)
    }
    if (points[3].y <= points[0].y) points = pointsAt(0)
    const [start, p1, p2, end] = points
    const c1 = {
      x: (54 * p1.x - 27 * p2.x - 15 * start.x + 6 * end.x) / 18,
      y: (54 * p1.y - 27 * p2.y - 15 * start.y + 6 * end.y) / 18,
    }
    const c2 = {
      x: (54 * p2.x - 27 * p1.x + 6 * start.x - 15 * end.x) / 18,
      y: (54 * p2.y - 27 * p1.y + 6 * start.y - 15 * end.y) / 18,
    }
    // At extreme settings a fitted cubic can overshoot its sampled trajectory.
    // Ordered y-controls preserve a simple, downward-moving editable stroke.
    const height = end.y - start.y
    c1.y = bounded(c1.y, start.y + height / 3, start.y + height * 0.03, start.y + height * 0.48)
    c2.y = bounded(c2.y, start.y + (2 * height) / 3, start.y + height * 0.52, end.y - height * 0.03)
    return { start, c1, c2, end }
  }

  function advance(x: number, row: number, column: number, spacing: number): number {
    const v = (row + 0.5) * bandHeight
    const arcLength = spacing * (0.83 + 0.34 * rand(row, column, 7))
    const first = arcLength / Math.hypot(1, surface(x, v).dx)
    return arcLength / Math.hypot(1, surface(x + first / 2, v).dx)
  }

  return {
    stroke,
    advance,
    rand,
    verticalPadding: bandHeight * (1 + rowStrength) + 18.5 * strength + 2,
  }
}

type StrokeField = ReturnType<typeof makeStrokeField>

/** Stroke width before each stroke's own variation: narrower than asked when strokes would touch. */
const safeStrokeWidth = (options: OrganicHatchOptions, pitch: number) =>
  Math.min(options.strokeWidth, pitch * (0.68 - options.curvature * 0.01))

/**
 * Walks every band of `rows` from the field's left padding to `right`, handing each stroke that
 * meets `window` to `emit`. Stops early when `emit` returns false.
 */
function walk(
  field: StrokeField,
  options: OrganicHatchOptions,
  pitch: number,
  window: { x0: number; y0: number; x1: number; y1: number },
  emit: (stroke: OrganicHatchStroke) => boolean,
) {
  const safeWidth = safeStrokeWidth(options, pitch)
  const firstRow = Math.floor((window.y0 - field.verticalPadding) / options.bandHeight)
  const lastRow = Math.ceil((window.y1 + field.verticalPadding) / options.bandHeight)
  for (let row = firstRow; row <= lastRow; row += 1) {
    let column = 0
    let x = -ORGANIC_HATCH_LEFT_PADDING + field.rand(row, 0, 3) * pitch
    while (x < window.x1 + ORGANIC_HATCH_LEFT_PADDING) {
      const { start, c1, c2, end } = field.stroke(row, column, x)
      const width = safeWidth * (0.78 + field.rand(row, column, 6) * 0.44)
      const half = width / 2
      if (
        Math.max(start.x, c1.x, c2.x, end.x) + half >= window.x0 &&
        Math.min(start.x, c1.x, c2.x, end.x) - half <= window.x1 &&
        Math.max(start.y, c1.y, c2.y, end.y) + half >= window.y0 &&
        Math.min(start.y, c1.y, c2.y, end.y) - half <= window.y1
      ) {
        if (!emit({ start, c1, c2, end, width })) return
      }
      x += field.advance(x, row, column, pitch)
      column += 1
    }
  }
}

/** About how many strokes a window holds at the options' spacing. */
export function estimateOrganicHatchStrokes(window: HatchWindow, input: Partial<OrganicHatchOptions> = {}): number {
  const options = readOrganicHatchOptions(input)
  if (!(window.width > 0) || !(window.height > 0)) return 0
  return Math.ceil(
    ((window.width + 2) * (window.height + 2 * options.bandHeight)) / (options.bandHeight * options.spacing),
  )
}

export interface OrganicHatchStrokes {
  strokes: OrganicHatchStroke[]
  options: OrganicHatchOptions
}

/**
 * The strokes of the open field that meet `window`, in the field's own coordinates (origin 0,0).
 * The density is exactly the options' spacing, whatever the window: neighbouring windows, chunks
 * of a map and the pieces of a print all agree. The field starts `ORGANIC_HATCH_LEFT_PADDING`
 * left of its origin, so put the origin at or left of every area it fills.
 *
 * A window estimated to hold more than `maxStrokes` strokes is refused with a RangeError rather
 * than thinned: split it, or choose a wider spacing on purpose.
 */
export function organicHatchStrokes(
  window: HatchWindow,
  input: Partial<OrganicHatchOptions> = {},
  { maxStrokes = DEFAULT_MAX_WINDOW_STROKES }: { maxStrokes?: number } = {},
): OrganicHatchStrokes {
  const options = readOrganicHatchOptions(input)
  const values = [window.x, window.y, window.width, window.height]
  if (!values.every(Number.isFinite) || window.width <= 0 || window.height <= 0) return { strokes: [], options }
  const estimate = estimateOrganicHatchStrokes(window, options)
  if (estimate > maxStrokes)
    throw new RangeError(
      `This hatch window holds about ${estimate} strokes, over the limit of ${maxStrokes}. Split the window or widen the spacing.`,
    )
  const strokes: OrganicHatchStroke[] = []
  walk(
    makeStrokeField(options),
    options,
    options.spacing,
    { x0: window.x, y0: window.y, x1: window.x + window.width, y1: window.y + window.height },
    (stroke) => {
      strokes.push(stroke)
      return true
    },
  )
  return { strokes, options }
}

export interface OrganicHatchTileStrokes {
  /** Strokes anchored inside the tile; draw each again shifted by ±width and ±height to wrap it. */
  strokes: OrganicHatchStroke[]
  width: number
  height: number
  /** The band height drawn: the asked one adjusted so a whole number of bands fills the height. */
  bandHeight: number
}

/**
 * Strokes for a tile that repeats seamlessly every `width` × `height` pattern units: the field is
 * blended with shifted copies of itself, so the waves are a little calmer than the open field's.
 * Use it where a renderer can only repeat an image (MapLibre's `fill-pattern`); exports should draw
 * the open field (`organicHatchStrokes`).
 */
export function organicHatchTileStrokes(
  input: Partial<OrganicHatchOptions>,
  size: { width: number; height: number },
): OrganicHatchTileStrokes {
  const asked = readOrganicHatchOptions(input)
  const width = Math.max(asked.spacing * 4, size.width)
  const rows = Math.max(1, Math.round(size.height / asked.bandHeight))
  const height = Math.max(asked.bandHeight, size.height)
  const options = { ...asked, bandHeight: height / rows }
  const field = makeStrokeField(options, { width, height, rows })
  const safeWidth = safeStrokeWidth(options, options.spacing)
  const strokes: OrganicHatchStroke[] = []
  for (let row = 0; row < rows; row += 1) {
    let column = 0
    let x = field.rand(row, 0, 3) * options.spacing
    while (x < width) {
      const stroke = field.stroke(row, column, x)
      strokes.push({ ...stroke, width: safeWidth * (0.78 + field.rand(row, column, 6) * 0.44) })
      x += field.advance(x, row, column, options.spacing)
      column += 1
    }
  }
  return { strokes, width, height, bandHeight: options.bandHeight }
}

/** A number as the SVG writers print it: two decimals at most, no negative zero. */
export function formatHatchNumber(value: number): string {
  return String(Math.round(value * 100) / 100 || 0)
}

/** SVG path data for one stroke. */
export function organicHatchStrokePath({ start, c1, c2, end }: OrganicHatchStroke): string {
  const n = formatHatchNumber
  return `M${n(start.x)} ${n(start.y)}C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(end.x)} ${n(end.y)}`
}

/**
 * The hatch of a `width` × `height` artboard as one colour-inheriting SVG group of individually
 * editable strokes, origin (0,0). The caller clips it. Non-positive or non-finite extents return
 * an empty group; finite extents cap at 4096. Over 30,000 strokes the spacing is widened across
 * the whole field, reported in `data-effective-spacing` and `data-budget-limited`, without
 * truncating the bottom rows. For predictable print density use `organicHatchStrokes` instead.
 */
export function organicHatchSvgGroup(width: number, height: number, input: Partial<OrganicHatchOptions> = {}): string {
  const options = readOrganicHatchOptions(input)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return `<g data-generator="${ORGANIC_HATCH_GENERATOR}" data-stroke-count="0"/>`
  }
  const w = Math.min(width, MAX_SVG_DIMENSION)
  const h = Math.min(height, MAX_SVG_DIMENSION)
  const field = makeStrokeField(options)
  let spacing = Math.max(options.spacing, (w * h) / (options.bandHeight * (MAX_SVG_STROKES - 256)))

  function draw(pitch: number): string[] {
    const paths: string[] = []
    walk(field, options, pitch, { x0: 0, y0: 0, x1: w, y1: h }, (stroke) => {
      paths.push(`<path d="${organicHatchStrokePath(stroke)}" stroke-width="${formatHatchNumber(stroke.width)}"/>`)
      return paths.length <= MAX_SVG_STROKES
    })
    return paths
  }

  let paths = draw(spacing)
  while (paths.length > MAX_SVG_STROKES) {
    spacing *= 1.1
    paths = draw(spacing)
  }
  return (
    `<g data-generator="${ORGANIC_HATCH_GENERATOR}" data-seed="${options.seed}" data-stroke-count="${paths.length}" ` +
    `data-effective-spacing="${formatHatchNumber(spacing)}" data-budget-limited="${spacing > options.spacing}" ` +
    `fill="none" stroke="currentColor" stroke-linecap="round">\n${paths.join('\n')}\n</g>`
  )
}

/** A standalone 600 × 360 vector sample in `color`. */
export function organicHatchSwatchSvg(options: Partial<OrganicHatchOptions> = {}, color = '#BCC454'): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360" color="${color}">` +
    '<title>Procedural forest hatching</title>' +
    '<desc>Short cubic strokes follow locally varying contour bands with arc-length spacing and staggered endpoints. Authored geometry, not a raster trace.</desc>' +
    '<rect width="600" height="360" fill="white"/>' +
    organicHatchSvgGroup(600, 360, options) +
    '</svg>'
  )
}
