import { arc, pie, type PieArcDatum } from 'd3'
import { useMemo, type ReactNode, type SVGProps } from 'react'
import { layoutDonutRing, type DonutRingLayoutOptions } from '../donutRing.js'

export interface DonutRingItem {
  id: string
  longitude: number
  latitude: number
  /** Category values in legend order; drawn counter-clockwise from the top, so the legend reads round the ring. */
  values: readonly number[]
  /** Centre text, e.g. the total. */
  centerLabel?: string
  /** Name under (bottom row) or over (elsewhere) the donut; shrinks to its slot. */
  name?: string
  /** Fill of the place marker on the map (default `leaderColor`). */
  pointColor?: string
  /** Draw the place as a muted ring (e.g. a retired site) instead of a solid dot. */
  muted?: boolean
}

export interface DonutRingMapProps extends Pick<DonutRingLayoutOptions, 'maxRadius' | 'minRadius' | 'projection'> {
  width: number
  land: GeoJSON.FeatureCollection
  items: readonly DonutRingItem[]
  /** Category colours, matching `values`. */
  colors: readonly string[]
  /** Category to emphasise; the others fade (legend hover). */
  emphasized?: number | null
  /** Fixed svg height; the drawing scales into it. Defaults to the layout's own height. */
  height?: number
  landColor?: string
  landStroke?: string
  /** Donut centre and slice separators. */
  panelColor?: string
  textColor?: string
  leaderColor?: string
  mutedColor?: string
  fontFamily?: string
  /** Host attributes and handlers for each item's group (tooltips, data attributes). */
  itemProps?: (item: DonutRingItem) => SVGProps<SVGGElement>
  /** Shown while the layout cannot be made (no items, or too many to fit). */
  empty?: ReactNode
  label?: string
}

/**
 * A world map ringed by one donut per place, each joined to its place by a leader (SPARTAN's network
 * figure, generalised). Drawn as one SVG with d3 shapes, so it prints and exports as vector art.
 */
export function DonutRingMap({
  width,
  land,
  items,
  colors,
  emphasized = null,
  height,
  landColor = '#ffffff',
  landStroke = '#5b6470',
  panelColor = '#ffffff',
  textColor = '#1f2933',
  leaderColor = '#1f2e86',
  mutedColor = '#8a8a8a',
  fontFamily,
  itemProps,
  empty = null,
  label,
  maxRadius,
  minRadius,
  projection,
}: DonutRingMapProps) {
  const layout = useMemo(
    () =>
      layoutDonutRing({
        width: Math.max(320, width),
        land,
        places: items.map((it) => [it.longitude, it.latitude] as const),
        maxRadius,
        minRadius,
        projection,
      }),
    [width, land, items, maxRadius, minRadius, projection],
  )
  if (!layout) return <>{empty}</>
  const { radius: r, font, cell, path, points, slots, centres } = layout
  const slice = arc<PieArcDatum<number>>()
    .innerRadius(r * 0.56)
    .outerRadius(r)
  const wedges = pie<number>()
    .sort(null)
    .value((v) => Math.max(0, v))
  return (
    <svg
      width="100%"
      height={height ?? layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={label}
      fontFamily={fontFamily}
    >
      <g>
        {land.features.map((f, i) => (
          <path key={i} d={path(f) ?? ''} fill={landColor} stroke={landStroke} strokeWidth={0.5} />
        ))}
      </g>
      {items.map((it, i) => {
        const p = points[i]
        const c = centres[i]
        // the leader stops at the donut's edge
        const dx = p.x - c.x
        const dy = p.y - c.y
        const len = Math.hypot(dx, dy) || 1
        return (
          <line
            key={`l-${it.id}`}
            x1={c.x + (dx / len) * (r + 1)}
            y1={c.y + (dy / len) * (r + 1)}
            x2={p.x}
            y2={p.y}
            stroke={leaderColor}
            strokeOpacity={0.75}
            strokeWidth={0.9}
          />
        )
      })}
      {items.map((it, i) => {
        const p = points[i]
        return it.muted ? (
          <g key={`p-${it.id}`}>
            <circle cx={p.x} cy={p.y} r={5} fill={mutedColor} opacity={0.55} />
            <circle cx={p.x} cy={p.y} r={3} fill="#333" />
          </g>
        ) : (
          <circle
            key={`p-${it.id}`}
            cx={p.x}
            cy={p.y}
            r={4.2}
            fill={it.pointColor ?? leaderColor}
            stroke={panelColor}
            strokeWidth={0.8}
          />
        )
      })}
      {items.map((it, i) => {
        const c = centres[i]
        const below = slots[i].side === 'bottom'
        const name = it.name ?? ''
        // a long name shrinks to its slot's width rather than running into the next one
        const nameSize = name ? Math.min(font, (cell.w - 6) / (0.58 * name.length)) : font
        // counter-clockwise from the top in legend order: draw the reversed values clockwise
        const reversed = it.values.slice().reverse()
        const arcs = wedges(reversed)
        return (
          <g key={it.id} {...itemProps?.(it)}>
            <g transform={`translate(${c.x},${c.y})`}>
              <circle r={r} fill={panelColor} />
              {arcs.map((a, k) => {
                const band = it.values.length - 1 - k
                return (
                  <path
                    key={band}
                    d={slice(a) ?? ''}
                    fill={colors[band]}
                    stroke={panelColor}
                    strokeWidth={0.4}
                    opacity={emphasized != null && emphasized !== band ? 0.18 : 1}
                  />
                )
              })}
              {it.centerLabel && (
                <text
                  textAnchor="middle"
                  dy="0.36em"
                  fontSize={Math.max(9, r * 0.52)}
                  fontWeight={700}
                  fill={textColor}
                >
                  {it.centerLabel}
                </text>
              )}
            </g>
            {name && (
              <text
                x={c.x}
                y={below ? c.y + r + nameSize + 2 : c.y - r - 5}
                textAnchor="middle"
                fontSize={nameSize}
                fontWeight={600}
                fill={textColor}
              >
                {name}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
