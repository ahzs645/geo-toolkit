import { geoEquirectangular, geoPath, type GeoPath, type GeoProjection } from 'd3'

/**
 * Call-outs (donuts, labels) on a ring of slots around a map, each joined to its place by a leader line:
 * the arrangement of SPARTAN's network composition figure. Places keep their angular order around the
 * map's centre on the ring, so leaders do not cross, and among those orders the one with the shortest
 * total leader length wins.
 */
export interface RingPoint {
  x: number
  y: number
}
export type RingSide = 'top' | 'bottom' | 'left' | 'right'
export type RingSlot = RingPoint & { side: RingSide }

const angle = (p: RingPoint, c: RingPoint) => Math.atan2(p.y - c.y, p.x - c.x)

/**
 * The slot index for each point (slots.length ≥ points.length; spare slots stay empty). Points and
 * slots are both taken in angular order around `centre`; the assignment is the order-preserving one
 * (over every rotation of the ring) with the least total distance.
 */
export function assignRing(points: readonly RingPoint[], slots: readonly RingPoint[], centre: RingPoint): number[] {
  const n = points.length
  const s = slots.length
  if (!n) return []
  if (s < n) throw new Error(`assignRing: ${n} points need at least ${n} slots, got ${s}`)
  const pOrder = points.map((_, i) => i).sort((a, b) => angle(points[a], centre) - angle(points[b], centre))
  const sOrder = slots.map((_, i) => i).sort((a, b) => angle(slots[a], centre) - angle(slots[b], centre))
  const d = (pi: number, si: number) => Math.hypot(points[pi].x - slots[si].x, points[pi].y - slots[si].y)
  let best = Infinity
  let bestPick: number[] = []
  for (let rot = 0; rot < s; rot++) {
    const ring = sOrder.map((_, k) => sOrder[(k + rot) % s])
    // cost[i][j]: points 0..i placed, point i on ring slot j (strictly increasing j)
    const cost = Array.from({ length: n }, () => new Float64Array(s).fill(Infinity))
    const from = Array.from({ length: n }, () => new Int32Array(s).fill(-1))
    for (let j = 0; j <= s - n; j++) cost[0][j] = d(pOrder[0], ring[j])
    for (let i = 1; i < n; i++) {
      let runMin = Infinity
      let runArg = -1
      for (let j = i; j <= s - n + i; j++) {
        if (cost[i - 1][j - 1] < runMin) {
          runMin = cost[i - 1][j - 1]
          runArg = j - 1
        }
        cost[i][j] = runMin + d(pOrder[i], ring[j])
        from[i][j] = runArg
      }
    }
    let j = -1
    let total = Infinity
    for (let k = n - 1; k < s; k++)
      if (cost[n - 1][k] < total) {
        total = cost[n - 1][k]
        j = k
      }
    if (total < best) {
      best = total
      const pick = new Array<number>(n)
      for (let i = n - 1; i >= 0; i--) {
        pick[pOrder[i]] = ring[j]
        j = from[i][j]
      }
      bestPick = pick
    }
  }
  return bestPick
}

/** Slots round a width × height box: a row along the top and bottom, a column down each side. */
export function ringSlots(width: number, height: number, cell: { w: number; h: number }): RingSlot[] {
  const across = Math.max(1, Math.floor(width / cell.w))
  const down = Math.max(0, Math.floor((height - 2 * cell.h) / cell.h))
  const slots: RingSlot[] = []
  for (let k = 0; k < across; k++) {
    const x = ((k + 0.5) * width) / across
    slots.push({ x, y: cell.h / 2, side: 'top' }, { x, y: height - cell.h / 2, side: 'bottom' })
  }
  const step = down ? (height - 2 * cell.h) / down : 0
  for (let k = 0; k < down; k++) {
    const y = cell.h + (k + 0.5) * step
    slots.push({ x: cell.w / 2, y, side: 'left' }, { x: width - cell.w / 2, y, side: 'right' })
  }
  return slots
}

export interface DonutRingLayoutOptions {
  width: number
  /** Land drawn in the middle; its extent sets the map's aspect. */
  land: GeoJSON.FeatureCollection
  /** [lon, lat] of each call-out's place. */
  places: readonly (readonly [number, number])[]
  /** Largest and smallest donut radius tried (default 40 and 11 px; the largest that fits wins). */
  maxRadius?: number
  minRadius?: number
  /** Projection to fit; default equirectangular, as in SPARTAN's figure. */
  projection?: () => GeoProjection
}

export interface DonutRingLayout {
  width: number
  height: number
  radius: number
  /** Name label size for this radius. */
  font: number
  cell: { w: number; h: number }
  projection: GeoProjection
  path: GeoPath
  /** Each place on the map, in input order. */
  points: RingPoint[]
  /** Each place's slot on the ring, in input order. */
  slots: RingSlot[]
  /** Each donut's centre: the slot shifted to leave its name room (below on the bottom row, above elsewhere). */
  centres: RingPoint[]
}

/**
 * The largest donut whose ring of slots still holds every place; the map fills the box inside the ring.
 * Null when there are no places or they cannot fit even at `minRadius`.
 */
export function layoutDonutRing({
  width,
  land,
  places,
  maxRadius = 40,
  minRadius = 11,
  projection: makeProjection = geoEquirectangular,
}: DonutRingLayoutOptions): DonutRingLayout | null {
  if (!places.length) return null
  for (let r = Math.min(maxRadius, width / 26); r >= minRadius; r -= 1) {
    const font = Math.max(8.5, Math.min(12.5, r * 0.42))
    const cell = { w: Math.max(2 * r + 12, 2.6 * r + 6), h: 2 * r + font + 12 }
    const projection = makeProjection().fitWidth(width - 2 * cell.w, land)
    const [[, y0], [, y1]] = geoPath(projection).bounds(land)
    const height = Math.round(y1 - y0 + 2 * cell.h)
    const ring = ringSlots(width, height, cell)
    if (ring.length < places.length) continue
    projection.fitExtent(
      [
        [cell.w, cell.h],
        [width - cell.w, height - cell.h],
      ],
      land,
    )
    const points = places.map((p) => {
      const [x, y] = projection([p[0], p[1]]) ?? [Number.NaN, Number.NaN]
      return { x, y }
    })
    const slots = assignRing(points, ring, { x: width / 2, y: height / 2 }).map((i) => ring[i])
    const shift = (font + 6) / 2
    const centres = slots.map((sl) => ({ x: sl.x, y: sl.y + (sl.side === 'bottom' ? -shift : shift) }))
    return { width, height, radius: r, font, cell, projection, path: geoPath(projection), points, slots, centres }
  }
  return null
}
