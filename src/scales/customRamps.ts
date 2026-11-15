/**
 * A colour ramp a person makes: the colours they picked and where each sits along the ramp. The
 * palette scale takes a ramp as evenly spaced anchors, so a custom ramp is resampled to anchors
 * (blending in Lab, flat before its first stop and after its last) before anything draws with it.
 * No DOM or network access; `ui/custom-ramps` keeps a person's ramps in the browser.
 */
import { color, interpolateLab } from 'd3'

export interface CustomRamp {
  name: string
  /** The colours picked, low to high, as lower-case `#rrggbb`. */
  stops: string[]
  /** Where each stop sits, 0 to 1 and never falling. Absent: evenly spaced. */
  at?: number[]
}

export const CUSTOM_RAMP_LIMITS = { minStops: 2, maxStops: 12, maxName: 40, anchors: 9 } as const
/** Ids of custom ramps start with this, so they cannot collide with a built-in ramp's id. */
export const CUSTOM_RAMP_PREFIX = 'custom:'
export const customRampId = (name: string) => `${CUSTOM_RAMP_PREFIX}${name}`
export const isCustomRampId = (id: string) => id.startsWith(CUSTOM_RAMP_PREFIX)

/** A colour as lower-case `#rrggbb`, or `null` for anything that is not a three- or six-digit hex. */
export function rampHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  const hex = match[1].toLowerCase()
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`
}

/** Colours typed or pasted as hex codes ("#fff, 0a0a0a #123456"), or `null` when fewer than two are colours. */
export function parseRampStops(text: string): string[] | null {
  const stops = text
    .split(/[\s,;]+/)
    .map((token) => (token ? rampHex(token) : null))
    .filter((stop): stop is string => stop !== null)
    .slice(0, CUSTOM_RAMP_LIMITS.maxStops)
  return stops.length >= CUSTOM_RAMP_LIMITS.minStops ? stops : null
}

const evenly = (count: number) => Array.from({ length: count }, (_, index) => (count === 1 ? 0 : index / (count - 1)))

/** Stop positions a ramp can use: one a stop, each 0 to 1, never falling; `undefined` when evenly spaced or unusable. */
export function cleanRampOffsets(at: unknown, count: number): number[] | undefined {
  if (!Array.isArray(at) || at.length !== count) return undefined
  const offsets = at.map(Number)
  if (offsets.some((t, index) => !Number.isFinite(t) || t < 0 || t > 1 || (index > 0 && t < offsets[index - 1])))
    return undefined
  return offsets.every((t, index) => Math.abs(t - evenly(count)[index]) < 1e-4) ? undefined : offsets
}

/** The colour of a ramp at `t` (0 to 1): blended in Lab between its stops, flat outside them. */
export function customRampColorAt(stops: readonly string[], at: readonly number[] | undefined, t: number): string {
  const offsets = at ?? evenly(stops.length)
  if (t <= offsets[0]) return stops[0]
  for (let index = 1; index < offsets.length; index++) {
    if (t <= offsets[index]) {
      const span = offsets[index] - offsets[index - 1]
      return span > 0
        ? color(interpolateLab(stops[index - 1], stops[index])((t - offsets[index - 1]) / span))!.formatHex()
        : stops[index]
    }
  }
  return stops[stops.length - 1]
}

/** A custom ramp as evenly spaced anchors, low to high: what a ramp picker and the palette scale take. */
export function customRampColors(
  ramp: Pick<CustomRamp, 'stops' | 'at'>,
  anchors: number = CUSTOM_RAMP_LIMITS.anchors,
): string[] {
  if (ramp.stops.length < 2) return [...ramp.stops]
  const at = cleanRampOffsets(ramp.at, ramp.stops.length)
  return Array.from({ length: anchors }, (_, index) => customRampColorAt(ramp.stops, at, index / (anchors - 1)))
}

/** A ramp's stops as a CSS gradient, each at its own position, for an editor's bar. */
export function customRampCss(stops: readonly string[], at?: readonly number[]): string {
  const offsets = at ?? evenly(stops.length)
  return `linear-gradient(to right, ${stops.map((stop, index) => `${stop} ${+(offsets[index] * 100).toFixed(2)}%`).join(', ')})`
}

/** A ramp read from storage or a file, or `null` when it is not one: never a half-read ramp. */
export function parseCustomRamp(value: unknown): CustomRamp | null {
  if (!value || typeof value !== 'object') return null
  const { name, stops, at } = value as { name?: unknown; stops?: unknown; at?: unknown }
  if (typeof name !== 'string' || !name.trim() || name.length > CUSTOM_RAMP_LIMITS.maxName) return null
  if (!Array.isArray(stops)) return null
  const read = stops.map((stop) => (typeof stop === 'string' ? rampHex(stop) : null))
  if (
    read.some((stop) => stop === null) ||
    read.length < CUSTOM_RAMP_LIMITS.minStops ||
    read.length > CUSTOM_RAMP_LIMITS.maxStops
  )
    return null
  const offsets = cleanRampOffsets(at, read.length)
  return { name: name.trim(), stops: read as string[], ...(offsets ? { at: offsets } : {}) }
}

/**
 * Why a name cannot be used, or `null` when it can. `taken` is every name in use (built-in labels
 * and the person's other ramps); `editing` is the ramp being renamed, whose own name is free.
 */
export function customRampNameProblem(name: string, taken: readonly string[], editing?: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Give the ramp a name'
  if (trimmed.length > CUSTOM_RAMP_LIMITS.maxName) return `Use ${CUSTOM_RAMP_LIMITS.maxName} characters or fewer`
  if (trimmed !== editing && taken.some((other) => other.toLowerCase() === trimmed.toLowerCase()))
    return 'A ramp already has that name'
  return null
}

/** A free name: "My gradient", then "My gradient 2"… */
export function freeCustomRampName(taken: readonly string[], base = 'My gradient'): string {
  for (let index = 1; ; index++) {
    const name = index === 1 ? base : `${base} ${index}`
    if (!customRampNameProblem(name, taken)) return name
  }
}
