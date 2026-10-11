import { useState, type ReactNode } from 'react'
import { Brush, CartesianGrid, Line, LineChart, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts'
import { SizedChart } from './XYPlot.js'
import { rangeIndices, type NumericRange } from './geometry.js'
import { axisStyle, tooltipStyle, tooltipWrapperStyle, numberLabel } from './axes.js'
import type { ChartAxis, ChartSeries, TimelineRow } from './types.js'

/** Controlled drag/brush range; hosts link the returned numeric interval to other plots. */
export function TimeSeriesChart({
  rows,
  series,
  range,
  onRange,
  height = 330,
  label = 'Time series',
  xAxis = {},
  yAxis = {},
  yDomain,
  formatValue = numberLabel,
  formatTooltipX,
  formatNavigatorX,
  empty = 'No observations.',
}: {
  rows: TimelineRow[]
  series: readonly ChartSeries[]
  range: NumericRange
  onRange: (range: NumericRange) => void
  height?: number
  label?: string
  xAxis?: ChartAxis
  yAxis?: ChartAxis
  /** Optional host-supplied Y domain; otherwise the visible observations determine the scale. */
  yDomain?: readonly [number, number]
  formatValue?: (value: number) => string
  formatTooltipX?: (value: number) => string
  formatNavigatorX?: (value: number) => string
  empty?: ReactNode
}) {
  const [drag, setDrag] = useState<[number, number] | null>(null)
  if (!rows.length) return <>{empty}</>
  const [startIndex, endIndex] = rangeIndices(
    rows.map((row) => row.x),
    range,
  )
  return (
    <div className="w-full min-w-0" style={{ height }} role="img" aria-label={label}>
      <SizedChart height={height}>
        {(width) => (
          <LineChart
            key={`${rows.length}-${rows[0].x}-${rows[rows.length - 1].x}`}
            width={width}
            height={height}
            data={rows}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
            onMouseDown={(event) => {
              const x = Number(event.activeLabel)
              if (Number.isFinite(x)) setDrag([x, x])
            }}
            onMouseMove={(event) => {
              const x = Number(event.activeLabel)
              if (drag && Number.isFinite(x)) setDrag([drag[0], x])
            }}
            onMouseUp={() => {
              if (drag && drag[0] !== drag[1]) onRange([Math.min(...drag), Math.max(...drag)])
              setDrag(null)
            }}
            onMouseLeave={() => setDrag(null)}
          >
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={xAxis.format}
              ticks={xAxis.ticks ? [...xAxis.ticks] : undefined}
              height={xAxis.label ? 45 : 30}
              label={
                xAxis.label
                  ? { value: xAxis.label, position: 'insideBottom', offset: 0, fill: axisStyle.stroke, fontSize: 11 }
                  : undefined
              }
              minTickGap={35}
              {...axisStyle}
            />
            <YAxis
              {...axisStyle}
              domain={yDomain ? [...yDomain] : ['auto', 'auto']}
              width={yAxis.width ?? (yAxis.label ? 72 : 60)}
              ticks={yAxis.ticks ? [...yAxis.ticks] : undefined}
              interval={yAxis.ticks ? 0 : 'preserveEnd'}
              tickFormatter={yAxis.format}
              label={
                yAxis.label
                  ? { value: yAxis.label, angle: -90, position: 'insideLeft', fill: axisStyle.stroke, fontSize: 11 }
                  : undefined
              }
            />
            <Tooltip
              isAnimationActive={false}
              allowEscapeViewBox={{ x: false, y: false }}
              wrapperStyle={tooltipWrapperStyle}
              contentStyle={tooltipStyle}
              labelFormatter={(value) => (formatTooltipX ?? xAxis.format ?? numberLabel)(Number(value))}
              formatter={(value) => [value == null ? 'Missing' : formatValue(Number(value))]}
            />
            {series.map((item) => (
              <Line
                key={item.id}
                dataKey={item.id}
                name={item.label}
                stroke={item.color}
                strokeWidth={1.8}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {drag && (
              <ReferenceArea
                x1={Math.min(...drag)}
                x2={Math.max(...drag)}
                fill="hsl(var(--primary))"
                fillOpacity={0.12}
              />
            )}
            <Brush
              dataKey="x"
              height={32}
              startIndex={startIndex}
              endIndex={endIndex}
              travellerWidth={10}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={formatNavigatorX ?? xAxis.format}
              onChange={(value) => {
                if (value.startIndex === undefined || value.endIndex === undefined) return
                const first = rows[value.startIndex]?.x,
                  last = rows[value.endIndex]?.x
                if (first !== undefined && last !== undefined)
                  onRange(value.startIndex === 0 && value.endIndex === rows.length - 1 ? null : [first, last])
              }}
            >
              <LineChart data={rows}>
                {series.map((item) => (
                  <Line
                    key={item.id}
                    dataKey={item.id}
                    stroke={item.color}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </Brush>
          </LineChart>
        )}
      </SizedChart>
    </div>
  )
}
