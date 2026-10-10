import type { ReactNode } from 'react'
import { CartesianGrid, ReferenceLine, ScatterChart, XAxis, YAxis } from 'recharts'
import { XYPlot } from './XYPlot.js'
import { ScatterPoints, type ScatterPoint, type ScatterSeries } from './ScatterPoints.js'
import { axisStyle, axisTicks, numberLabel, selectionArea } from './axes.js'
import type { XYChartProps } from './types.js'

/** Canvas points retain every supplied observation; SVG axes stay small even for large series. */
export function ScatterPlot<P extends ScatterPoint>({
  series,
  height,
  extent,
  label,
  xAxis = {},
  yAxis = {},
  zoom,
  onZoom,
  empty = 'No observations.',
  identityLine = false,
  radius,
  opacity,
  hitRadius,
  renderTooltip,
}: XYChartProps & {
  series: readonly ScatterSeries<P>[]
  identityLine?: boolean
  radius?: number
  opacity?: number
  hitRadius?: number
  renderTooltip?: (point: P, color: string) => ReactNode
}) {
  if (!series.some((item) => item.points.length)) return <>{empty}</>
  const axisWidth = yAxis.width ?? 60
  const insets = { left: axisWidth - 15, right: 12, top: 8, bottom: 46 }
  return (
    <XYPlot height={height} bottom={16} insets={insets} extent={extent} label={label} zoom={zoom} onZoom={onZoom}>
      {(width, domain, drag) => {
        const lineMin = Math.max(domain[0], domain[2]),
          lineMax = Math.min(domain[1], domain[3])
        return (
          <div className="relative" style={{ width, height }}>
            <ScatterChart width={width} height={height} margin={{ top: 8, right: 12, left: -15, bottom: 16 }}>
              <CartesianGrid stroke="hsl(var(--border))" />
              <XAxis
                dataKey="x"
                type="number"
                domain={[domain[0], domain[1]]}
                allowDataOverflow
                ticks={xAxis.ticks ? [...xAxis.ticks] : axisTicks(domain[0], domain[1])}
                tickFormatter={xAxis.format ?? numberLabel}
                {...axisStyle}
                label={
                  xAxis.label
                    ? { value: xAxis.label, position: 'bottom', offset: 0, fill: axisStyle.stroke, fontSize: 11 }
                    : undefined
                }
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={[domain[2], domain[3]]}
                allowDataOverflow
                ticks={yAxis.ticks ? [...yAxis.ticks] : axisTicks(domain[2], domain[3])}
                tickFormatter={yAxis.format ?? numberLabel}
                {...axisStyle}
                width={axisWidth}
                label={
                  yAxis.label
                    ? {
                        value: yAxis.label,
                        angle: -90,
                        position: 'insideLeft',
                        offset: 20,
                        fill: axisStyle.stroke,
                        fontSize: 11,
                      }
                    : undefined
                }
              />
              {identityLine && lineMax > lineMin && (
                <ReferenceLine
                  segment={[
                    { x: lineMin, y: lineMin },
                    { x: lineMax, y: lineMax },
                  ]}
                  stroke={axisStyle.stroke}
                  strokeOpacity={0.5}
                  strokeDasharray="4 4"
                />
              )}
              {selectionArea(drag)}
            </ScatterChart>
            <ScatterPoints
              insets={insets}
              series={series}
              domain={domain}
              width={width}
              height={height}
              dragging={Boolean(drag)}
              radius={radius}
              opacity={opacity}
              hitRadius={hitRadius}
              renderTooltip={renderTooltip}
            />
          </div>
        )
      }}
    </XYPlot>
  )
}
