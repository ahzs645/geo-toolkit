import type { ReactNode } from 'react'
import type { XYDomain } from './geometry.js'

export interface ChartSeries {
  id: string
  label: string
  color: string
}
/** Host-supplied wide rows, sorted by x. Null is a gap, never zero or an interpolated observation. */
export interface TimelineRow {
  x: number
  [key: string]: number | null
}
export interface LineBandPoint {
  x: number
  y: number | null
  range?: readonly [number, number]
}
export interface LineBandSeries<P extends LineBandPoint = LineBandPoint> extends ChartSeries {
  points: readonly P[]
  strokeWidth?: number
  strokeOpacity?: number
  bandOpacity?: number
}
export interface ChartAxis {
  /** Y-axis width, including room for tick labels. XY interactions use this same dimension. */
  width?: number
  label?: string
  format?: (value: number) => string
  ticks?: readonly number[]
}
export interface XYChartProps {
  height: number
  extent: XYDomain
  label: string
  xAxis?: ChartAxis
  yAxis?: ChartAxis
  /** Omitted for local zoom; explicit null/domain for a host-controlled viewport. */
  zoom?: XYDomain | null
  onZoom?: (domain: XYDomain | null) => void
  empty?: ReactNode
}
