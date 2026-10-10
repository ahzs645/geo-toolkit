export type XYDomain = readonly [number, number, number, number]
export type XYSelection = readonly [number, number, number, number]
export type NumericRange = readonly [number, number] | null
export interface PlotInsets {
  left: number
  right: number
  top: number
  bottom: number
}

/** Insets include both chart margins and axis sizes. Supply the same geometry to axes and interactions. */
export function plotBounds(width: number, height: number, bottom = 0, insets?: PlotInsets) {
  const edges = insets ?? { left: 45, right: 12, top: 8, bottom: bottom + 30 }
  return {
    left: edges.left,
    top: edges.top,
    width: Math.max(1, width - edges.left - edges.right),
    height: Math.max(1, height - edges.top - edges.bottom),
  }
}

/** Nulls stay gaps, zero stays an observation; invalid numbers cannot poison axis domains. */
export function numericExtent(
  values: Iterable<number | null | undefined>,
  fallback: readonly [number, number] = [0, 1],
): readonly [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  if (min === Infinity) return fallback
  return min === max ? [min - 0.5, max + 0.5] : [min, max]
}

/** Map a controlled range onto a sorted navigator, including ranges outside its data. */
export function rangeIndices(values: readonly number[], range: NumericRange): readonly [number, number] {
  if (!values.length) return [0, 0]
  if (!range) return [0, values.length - 1]
  const first = values.findIndex((value) => value >= range[0])
  const start = first < 0 ? values.length - 1 : first
  let end = start
  for (let index = start; index < values.length && values[index] <= range[1]; index++) end = index
  return [start, end]
}
