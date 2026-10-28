/** Bounds and quantisation shared by the scrub field's drag, keys and typed input. */
export interface ScrubBounds {
  min?: number
  max?: number
  /** Quantum for every committed value (default 1). */
  step?: number
}

function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0
  const text = String(step)
  const exponent = /e-(\d+)$/.exec(text)
  if (exponent) return Number(exponent[1])
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

/** Clamp to the bounds and snap to the step grid anchored at `min` (or 0), without float residue. */
export function snapScrubValue(value: number, { min, max, step = 1 }: ScrubBounds): number {
  if (!Number.isFinite(value)) return min ?? max ?? 0
  const quantum = step > 0 ? step : 1
  const origin = min ?? 0
  let snapped = origin + Math.round((value - origin) / quantum) * quantum
  if (min !== undefined && snapped < min) snapped = min
  if (max !== undefined && snapped > max) snapped = max
  const decimals = Math.max(decimalsOf(quantum), decimalsOf(origin))
  return Number(snapped.toFixed(Math.min(decimals, 12)))
}

export interface ScrubDragOptions extends ScrubBounds {
  /** Field width in px: with both bounds, dragging its full width sweeps min → max. */
  width: number
  /** px per step when a bound is open (default 4). */
  pixelsPerStep?: number
  /** Multiplier for fine control, e.g. 0.1 while Shift is held. */
  precision?: number
}

/** The value after dragging `dx` px from where a drag started at `start`. */
export function scrubDragValue(start: number, dx: number, options: ScrubDragOptions): number {
  const { min, max, step = 1, width, pixelsPerStep = 4, precision = 1 } = options
  const bounded = min !== undefined && max !== undefined && max > min && width > 0
  const perPixel = bounded ? (max - min) / width : (step > 0 ? step : 1) / pixelsPerStep
  return snapScrubValue(start + dx * perPixel * precision, options)
}

/**
 * Read a typed value: accepts a decimal comma, surrounding whitespace, a trailing
 * unit ("50 %", "201mm") and a leading sign. Returns null for anything else so the
 * caller keeps its last committed value.
 */
export function parseScrubInput(text: string): number | null {
  const match = /^\s*([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)\s*[^\d\s]*\s*$/i.exec(text)
  if (!match) return null
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Where the value sits between the bounds, 0–1, or null when a bound is open. */
export function scrubFraction(value: number, { min, max }: ScrubBounds): number | null {
  if (min === undefined || max === undefined || !(max > min)) return null
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}
