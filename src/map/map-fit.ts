import type * as MapLibreGL from 'maplibre-gl'

export type LngLatPoint = readonly [number, number]
export type LngLatBounds = [[number, number], [number, number]]

export interface PointBoundsOptions {
  /**
   * Fraction trimmed from each end of the longitudes and latitudes, so a few
   * outlying points (overseas sites) do not shrink the rest to a speck. Applies
   * from five points up; default 0.
   */
  trim?: number
  /** Padding as a fraction of the span (default 0.08). */
  pad?: number
  /** Smallest span in degrees, so one point or a tight cluster gets a regional frame (default 4). */
  minSpan?: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function quantile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** South-west / north-east bounds around finite [lon, lat] points, or null when there are none. */
export function pointBounds(points: readonly LngLatPoint[], options: PointBoundsOptions = {}): LngLatBounds | null {
  const { trim = 0, pad = 0.08, minSpan = 4 } = options
  const finite = points.filter(
    ([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180,
  )
  if (!finite.length) return null
  const lons = finite.map((p) => p[0]).sort((a, b) => a - b)
  const lats = finite.map((p) => p[1]).sort((a, b) => a - b)
  const cut = finite.length >= 5 ? clamp(trim, 0, 0.45) : 0
  let [w, e] = [quantile(lons, cut), quantile(lons, 1 - cut)]
  let [s, n] = [quantile(lats, cut), quantile(lats, 1 - cut)]
  const grow = (lo: number, hi: number): [number, number] => {
    const span = Math.max(hi - lo, minSpan)
    const mid = (lo + hi) / 2
    const half = (span * (1 + 2 * pad)) / 2
    return [mid - half, mid + half]
  }
  ;[w, e] = grow(w, e)
  ;[s, n] = grow(s, n)
  return [
    [clamp(w, -180, 180), clamp(s, -85, 85)],
    [clamp(e, -180, 180), clamp(n, -85, 85)],
  ]
}

export interface FitMapToPointsOptions extends PointBoundsOptions {
  /** Screen padding in px (default 32). */
  padding?: number
  maxZoom?: number
  /** Animation length in ms; 0 jumps (default 300). */
  duration?: number
}

/** Frame the map on the points; returns false (and leaves the camera) when none are finite. */
export function fitMapToPoints(
  map: MapLibreGL.Map,
  points: readonly LngLatPoint[],
  { padding = 32, maxZoom = 8, duration = 300, ...bounds }: FitMapToPointsOptions = {},
): boolean {
  const box = pointBounds(points, bounds)
  if (!box) return false
  const canvas = map.getCanvas()
  // fitBounds throws away the padding when the canvas is smaller than twice of it
  const room = Math.max(0, Math.min(padding, (canvas.clientWidth - 40) / 2, (canvas.clientHeight - 40) / 2))
  map.fitBounds(box, { padding: room, maxZoom, duration })
  return true
}
