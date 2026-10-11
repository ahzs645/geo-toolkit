import { plotBounds, type PlotInsets, type XYDomain } from './geometry.js'
import type { LineBandPoint, LineBandSeries } from './types.js'

/** Inspect adjacent samples/segments without bridging null gaps or scanning every year. */
export function nearestLinePoint<P extends LineBandPoint>(
  series: readonly LineBandSeries<P>[],
  domain: XYDomain,
  width: number,
  height: number,
  insets: PlotInsets,
  x: number,
  y: number,
  radius = 12,
) {
  const plot = plotBounds(width, height, 0, insets)
  if (x < plot.left || x > plot.left + plot.width || y < plot.top || y > plot.top + plot.height) return null
  const atX = domain[0] + ((x - plot.left) / plot.width) * (domain[1] - domain[0])
  const project = (point: P) => ({
    x: plot.left + ((point.x - domain[0]) / (domain[1] - domain[0])) * plot.width,
    y: plot.top + ((domain[3] - Number(point.y)) / (domain[3] - domain[2])) * plot.height,
  })
  let nearest: { point: P; series: LineBandSeries<P> } | null = null
  let best = radius ** 2
  for (const item of series) {
    const points = item.points
    let lo = 0,
      hi = points.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (points[mid].x < atX) lo = mid + 1
      else hi = mid
    }
    for (let index = Math.max(0, lo - 1); index <= Math.min(points.length - 1, lo); index++) {
      const point = points[index]
      if (point.y === null || !Number.isFinite(point.y)) continue
      const a = project(point)
      const next = points[index + 1]
      const b = next && next.y !== null && Number.isFinite(next.y) ? project(next) : a
      const dx = b.x - a.x,
        dy = b.y - a.y
      const length = dx * dx + dy * dy
      const t = length ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length)) : 0
      const distance = (x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2
      if (distance < best) {
        best = distance
        nearest = { point: next && t > 0.5 ? next : point, series: item }
      }
    }
  }
  return nearest
}
