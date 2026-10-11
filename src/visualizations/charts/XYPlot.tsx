import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Button } from '../../ui/button.js'

import { plotBounds, type XYDomain, type XYSelection, type PlotInsets } from './geometry.js'

export function SizedChart({ height, children }: { height: number; children: (width: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const resize = () => setWidth(Math.max(0, Math.floor(element.getBoundingClientRect().width)))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className="w-full min-w-0" style={{ height, overflow: 'clip' }}>
      {width > 0 && children(width)}
    </div>
  )
}

/** Shared local XY interaction: drag a rectangle; show a reset only after zooming. */
export function XYPlot({
  height,
  bottom = 0,
  insets,
  resetLabel = 'Reset zoom',
  zoom: controlledZoom,
  onZoom,
  extent,
  label,
  children,
}: {
  height: number
  bottom?: number
  insets?: PlotInsets
  resetLabel?: string
  zoom?: XYDomain | null
  onZoom?: (domain: XYDomain | null) => void
  extent: XYDomain
  label: string
  children: (width: number, domain: XYDomain, drag: XYSelection | null) => ReactNode
}) {
  const [localZoom, setLocalZoom] = useState<XYDomain | null>(null)
  const zoom = controlledZoom === undefined ? localZoom : controlledZoom
  const setZoom = (value: XYDomain | null) => {
    if (controlledZoom === undefined) setLocalZoom(value)
    onZoom?.(value)
  }
  const [drag, setDrag] = useState<XYSelection | null>(null)
  const domain = zoom ?? extent
  const pointerValue = (event: PointerEvent<HTMLDivElement>): readonly [number, number] | null => {
    const rect = event.currentTarget.getBoundingClientRect()
    const plot = plotBounds(rect.width, height, bottom, insets)
    const x = event.clientX - rect.left - plot.left
    const y = event.clientY - rect.top - plot.top
    if (x < 0 || x > plot.width || y < 0 || y > plot.height) return null
    return [
      domain[0] + (x / plot.width) * (domain[1] - domain[0]),
      domain[3] - (y / plot.height) * (domain[3] - domain[2]),
    ]
  }
  return (
    <div
      className="relative min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ height }}
      role="group"
      data-testid="xy-plot"
      tabIndex={0}
      aria-label={`${label}; drag to zoom both axes, press + to zoom or Home to reset`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Home') {
          event.preventDefault()
          setZoom(null)
        }
        if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          setZoom([
            domain[0] + (domain[1] - domain[0]) / 4,
            domain[1] - (domain[1] - domain[0]) / 4,
            domain[2] + (domain[3] - domain[2]) / 4,
            domain[3] - (domain[3] - domain[2]) / 4,
          ])
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'touch' || event.button !== 0) return
        const point = pointerValue(event)
        if (point) {
          event.currentTarget.setPointerCapture(event.pointerId)
          setDrag([point[0], point[1], point[0], point[1]])
        }
      }}
      onPointerMove={(event) => {
        if (!drag) return
        const point = pointerValue(event)
        if (point) setDrag([drag[0], drag[1], point[0], point[1]])
      }}
      onPointerUp={(event) => {
        if (drag) {
          const rect = event.currentTarget.getBoundingClientRect()
          const plot = plotBounds(rect.width, height, bottom, insets)
          const dx = (Math.abs(drag[2] - drag[0]) / (domain[1] - domain[0])) * plot.width
          const dy = (Math.abs(drag[3] - drag[1]) / (domain[3] - domain[2])) * plot.height
          if (dx > 6 && dy > 6)
            setZoom([
              Math.min(drag[0], drag[2]),
              Math.max(drag[0], drag[2]),
              Math.min(drag[1], drag[3]),
              Math.max(drag[1], drag[3]),
            ])
        }
        setDrag(null)
      }}
      onPointerCancel={() => setDrag(null)}
    >
      <SizedChart height={height}>{(width) => children(width, domain, drag)}</SizedChart>
      {zoom && (
        <Button
          className="absolute right-3 top-2 h-7 bg-background/90 px-2 text-xs shadow-sm"
          variant="outline"
          size="sm"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setZoom(null)}
        >
          {resetLabel}
        </Button>
      )}
    </div>
  )
}
