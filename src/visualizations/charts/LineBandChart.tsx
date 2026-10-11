import { useMemo, useState, type ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { XYPlot } from './XYPlot.js'
import { plotBounds } from './geometry.js'
import { axisStyle, axisTicks, numberLabel, selectionArea, tooltipWrapperStyle } from './axes.js'
import { nearestLinePoint } from './lineHover.js'
import type { LineBandPoint, LineBandSeries, XYChartProps } from './types.js'

/** Raw lines or mean lines with supplied bounds. The host defines what a band means. */
export function LineBandChart<P extends LineBandPoint>({
  series,
  height,
  extent,
  label,
  xAxis = {},
  yAxis = {},
  zoom,
  onZoom,
  empty = 'No observations.',
  renderTooltip,
  highlightOnHover = false,
}: XYChartProps & {
  series: readonly LineBandSeries<P>[]
  renderTooltip?: (point: P, series: LineBandSeries<P>) => ReactNode
  /** Emphasize the nearest line and dim the others while inspecting an observation. */
  highlightOnHover?: boolean
}) {
  const prepared = useMemo(
    () =>
      series.map((item) => ({
        ...item,
        chartData: [...item.points],
        hasRange: item.points.some((point) => point.range),
      })),
    [series],
  )
  const [hover, setHover] = useState<{
    point: P
    item: LineBandSeries<P>
    source: readonly LineBandSeries<P>[]
    domain: typeof extent
  } | null>(null)
  if (!series.some((item) => item.points.length)) return <>{empty}</>
  const bottom = xAxis.label ? 16 : 4
  const axisWidth = yAxis.width ?? 60
  const insets = { left: axisWidth - 15, right: 12, top: 8, bottom: bottom + 30 }
  return (
    <XYPlot height={height} bottom={bottom} insets={insets} extent={extent} label={label} zoom={zoom} onZoom={onZoom}>
      {(width, domain, drag) => {
        const activeHover =
          highlightOnHover && !drag && hover?.source === series && hover.domain === domain ? hover : null
        return (
          <ComposedChart
            width={width}
            height={height}
            margin={{ top: 8, right: 12, left: -15, bottom }}
            onMouseMove={(_, event) => {
              if (!highlightOnHover || drag) return
              const rect = event.currentTarget.getBoundingClientRect()
              const nearest = nearestLinePoint(
                series,
                domain,
                width,
                height,
                insets,
                event.clientX - rect.left,
                event.clientY - rect.top,
              )
              setHover((previous) => {
                if (!nearest) return previous ? null : previous
                if (
                  previous?.point === nearest.point &&
                  previous.item === nearest.series &&
                  previous.source === series &&
                  previous.domain === domain
                )
                  return previous
                return { point: nearest.point, item: nearest.series, source: series, domain }
              })
            }}
            onMouseLeave={() => setHover(null)}
          >
            <CartesianGrid stroke="hsl(var(--border))" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[domain[0], domain[1]]}
              allowDataOverflow
              ticks={xAxis.ticks ? [...xAxis.ticks] : axisTicks(domain[0], domain[1])}
              tickFormatter={xAxis.format}
              label={
                xAxis.label
                  ? { value: xAxis.label, position: 'bottom', offset: 0, fill: axisStyle.stroke, fontSize: 11 }
                  : undefined
              }
              minTickGap={24}
              interval="preserveStartEnd"
              {...axisStyle}
            />
            <YAxis
              {...axisStyle}
              domain={[domain[2], domain[3]]}
              allowDataOverflow
              ticks={yAxis.ticks ? [...yAxis.ticks] : axisTicks(domain[2], domain[3])}
              tickFormatter={yAxis.format ?? numberLabel}
              width={axisWidth}
              label={
                yAxis.label
                  ? { value: yAxis.label, position: 'insideTopRight', fill: axisStyle.stroke, fontSize: 11 }
                  : undefined
              }
            />
            <Tooltip
              active={highlightOnHover ? Boolean(activeHover) : undefined}
              isAnimationActive={false}
              allowEscapeViewBox={{ x: false, y: false }}
              wrapperStyle={tooltipWrapperStyle}
              cursor={false}
              content={({ active, payload, coordinate }) => {
                if (drag || (highlightOnHover ? !activeHover : !active || !payload?.length)) return null
                const plot = plotBounds(width, height, bottom, insets)
                const atY = domain[3] - ((Number(coordinate?.y) - plot.top) / plot.height) * (domain[3] - domain[2])
                const entry = (payload ?? [])
                  .filter((item) => typeof item.value === 'number')
                  .sort((a, b) => Math.abs(Number(a.value) - atY) - Math.abs(Number(b.value) - atY))[0]
                if (!entry && !activeHover) return null
                const item = highlightOnHover ? activeHover?.item : series.find((item) => item.id === entry?.name)
                if (!item) return null
                const point = highlightOnHover ? activeHover!.point : (entry!.payload as P)
                return (
                  <div
                    role="tooltip"
                    className="rounded-lg border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-sm"
                  >
                    {renderTooltip ? (
                      renderTooltip(point, item)
                    ) : (
                      <>
                        <div className="font-medium">{item.label}</div>
                        <div>
                          {(xAxis.format ?? numberLabel)(point.x)} · {(yAxis.format ?? numberLabel)(Number(point.y))}
                        </div>
                      </>
                    )}
                  </div>
                )
              }}
            />
            {prepared.flatMap((item) => [
              ...(item.hasRange
                ? [
                    <Area
                      key={`${item.id}-range`}
                      data={item.chartData}
                      dataKey={(point: P) => (point.range ? [...point.range] : null)}
                      tooltipType="none"
                      stroke="none"
                      fill={item.color}
                      fillOpacity={
                        (item.bandOpacity ?? 0.2) * (activeHover && activeHover.item.id !== item.id ? 0.25 : 1)
                      }
                      activeDot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />,
                  ]
                : []),
              <Line
                key={item.id}
                data={item.chartData}
                dataKey="y"
                name={item.id}
                stroke={item.color}
                strokeOpacity={activeHover ? (activeHover.item.id === item.id ? 1 : 0.15) : (item.strokeOpacity ?? 1)}
                strokeWidth={(item.strokeWidth ?? 2) + (activeHover?.item.id === item.id ? 1.5 : 0)}
                dot={false}
                activeDot={highlightOnHover ? (activeHover?.item.id === item.id ? { r: 3 } : false) : { r: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />,
            ])}
            {selectionArea(drag)}
          </ComposedChart>
        )
      }}
    </XYPlot>
  )
}
