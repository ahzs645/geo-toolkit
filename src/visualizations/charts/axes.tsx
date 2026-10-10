import { ticks } from 'd3'
import { ReferenceArea } from 'recharts'
import type { XYSelection } from './geometry.js'

export const axisStyle = { stroke: 'hsl(var(--muted-foreground))', fontSize: 11, tickLine: false, axisLine: false }
export const tooltipStyle = {
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
}
export const axisTicks = (min: number, max: number) => ticks(min, max, 5)
export const numberLabel = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3 })
export function selectionArea(drag: XYSelection | null) {
  return drag ? (
    <ReferenceArea
      x1={Math.min(drag[0], drag[2])}
      x2={Math.max(drag[0], drag[2])}
      y1={Math.min(drag[1], drag[3])}
      y2={Math.max(drag[1], drag[3])}
      fill="hsl(var(--primary))"
      fillOpacity={0.12}
    />
  ) : null
}
