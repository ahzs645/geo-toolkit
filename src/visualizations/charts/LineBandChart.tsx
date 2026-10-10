import type { ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { XYPlot } from './XYPlot.js'
import { plotBounds } from './geometry.js'
import { axisStyle, axisTicks, numberLabel, selectionArea } from './axes.js'
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
}: XYChartProps & {
  series: readonly LineBandSeries<P>[]
  renderTooltip?: (point: P, series: LineBandSeries<P>) => ReactNode
}) {
  if (!series.some((item) => item.points.length)) return <>{empty}</>
  const bottom = xAxis.label ? 16 : 4
  const axisWidth = yAxis.width ?? 60
  const insets = { left: axisWidth - 15, right: 12, top: 8, bottom: bottom + 30 }
  return (
    <XYPlot height={height} bottom={bottom} insets={insets} extent={extent} label={label} zoom={zoom} onZoom={onZoom}>
      {(width, domain, drag) => (
        <ComposedChart width={width} height={height} margin={{ top: 8, right: 12, left: -15, bottom }}>
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
            isAnimationActive={false}
            cursor={false}
            content={({ active, payload, coordinate }) => {
              if (!active || !payload?.length || drag) return null
              const plot = plotBounds(width, height, bottom, insets)
              const atY = domain[3] - ((Number(coordinate?.y) - plot.top) / plot.height) * (domain[3] - domain[2])
              const entry = payload
                .filter((item) => typeof item.value === 'number')
                .sort((a, b) => Math.abs(Number(a.value) - atY) - Math.abs(Number(b.value) - atY))[0]
              if (!entry) return null
              const item = series.find((item) => item.id === entry.name)
              if (!item) return null
              const point = entry.payload as P
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
          {series.flatMap((item) => [
            ...(item.points.some((point) => point.range)
              ? [
                  <Area
                    key={`${item.id}-range`}
                    data={[...item.points]}
                    dataKey={(point: P) => (point.range ? [...point.range] : null)}
                    tooltipType="none"
                    stroke="none"
                    fill={item.color}
                    fillOpacity={item.bandOpacity ?? 0.2}
                    activeDot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />,
                ]
              : []),
            <Line
              key={item.id}
              data={[...item.points]}
              dataKey="y"
              name={item.id}
              stroke={item.color}
              strokeOpacity={item.strokeOpacity ?? 1}
              strokeWidth={item.strokeWidth ?? 2}
              dot={false}
              activeDot={{ r: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />,
          ])}
          {selectionArea(drag)}
        </ComposedChart>
      )}
    </XYPlot>
  )
}
