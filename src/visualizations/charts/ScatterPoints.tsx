import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { plotBounds, type XYDomain, type PlotInsets } from './geometry.js'

export interface ScatterPoint {
  x: number
  y: number
}
export interface ScatterSeries<P extends ScatterPoint = ScatterPoint> {
  color: string
  points: readonly P[]
}

/** One canvas keeps thousands of raw observations out of the SVG/React tree. */
export function ScatterPoints<P extends ScatterPoint>({
  series,
  domain,
  width,
  height,
  dragging,
  insets,
  radius = 2,
  hitRadius = 12,
  opacity,
  renderTooltip,
}: {
  series: readonly ScatterSeries<P>[]
  domain: XYDomain
  width: number
  height: number
  dragging: boolean
  insets?: PlotInsets
  radius?: number
  hitRadius?: number
  opacity?: number
  renderTooltip?: (point: P, color: string) => ReactNode
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<{
    point: P
    color: string
    x: number
    y: number
    source: object
  } | null>(null)
  const plot = plotBounds(width, height, 16, insets)
  const [xmin, xmax, ymin, ymax] = domain
  const projected = useMemo(
    () =>
      series.map((item) => ({
        color: item.color,
        points: item.points
          .filter(
            (point) =>
              Number.isFinite(point.x) &&
              Number.isFinite(point.y) &&
              point.x >= xmin &&
              point.x <= xmax &&
              point.y >= ymin &&
              point.y <= ymax,
          )
          .map((point) => ({
            point,
            x: ((point.x - xmin) / (xmax - xmin)) * plot.width,
            y: ((ymax - point.y) / (ymax - ymin)) * plot.height,
          })),
      })),
    [series, xmin, xmax, ymin, ymax, plot.width, plot.height],
  )
  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(plot.width * ratio)
    canvas.height = Math.round(plot.height * ratio)
    context.scale(ratio, ratio)
    const count = series.reduce((sum, item) => sum + item.points.length, 0)
    // Density-dependent opacity keeps dense clouds legible without discarding points.
    context.globalAlpha = opacity ?? (count <= 1 ? 0.9 : Math.min(0.9, Math.sqrt(2 / Math.log10(count))))
    for (const item of projected) {
      context.fillStyle = item.color
      for (const point of item.points) {
        context.beginPath()
        context.arc(point.x, point.y, radius, 0, 2 * Math.PI)
        context.fill()
      }
    }
  }, [projected, series, plot.width, plot.height, radius, opacity])

  const inspectPoint = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left - plot.left
    const y = event.clientY - rect.top - plot.top
    let nearest: typeof hover = null
    let distance = hitRadius ** 2
    for (const item of projected) {
      for (const point of item.points) {
        const squared = (point.x - x) ** 2 + (point.y - y) ** 2
        if (squared < distance) {
          distance = squared
          nearest = { ...point, color: item.color, source: projected }
        }
      }
    }
    setHover(nearest)
  }
  return (
    <div className="absolute inset-0" onPointerMove={inspectPoint} onPointerLeave={() => setHover(null)}>
      <canvas
        ref={ref}
        aria-hidden="true"
        data-testid="scatter-points"
        className="pointer-events-none absolute"
        style={{ left: plot.left, top: plot.top, width: plot.width, height: plot.height }}
      />
      {hover && hover.source === projected && !dragging && (
        <>
          <span
            className="pointer-events-none absolute size-2 rounded-full border-2 bg-background"
            style={{ left: plot.left + hover.x - 4, top: plot.top + hover.y - 4, borderColor: hover.color }}
          />
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-10 max-w-[calc(100%-3rem)] rounded-lg border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-sm"
            style={hover.x > plot.width / 2 ? { left: plot.left + 4 } : { right: 12 }}
          >
            {renderTooltip ? renderTooltip(hover.point, hover.color) : `${hover.point.x}, ${hover.point.y}`}
          </div>
        </>
      )}
    </div>
  )
}
