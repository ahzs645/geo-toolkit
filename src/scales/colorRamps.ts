/**
 * Named colour ramps for classed and continuous data: what a ramp picker offers. Each ramp is a
 * short list of anchor colours read from d3's own schemes (the matplotlib perceptual ramps,
 * Turbo and ColorBrewer), which the palette scale interpolates; nothing here draws anything.
 * Ids are saved in layer styles, so rename a label, never an id. No DOM or network access.
 */
import {
  color,
  interpolateBlues,
  interpolateBrBG,
  interpolateCividis,
  interpolateGreens,
  interpolateGreys,
  interpolateInferno,
  interpolateMagma,
  interpolateOranges,
  interpolatePlasma,
  interpolatePuOr,
  interpolatePurples,
  interpolateRdBu,
  interpolateRdYlBu,
  interpolateRdYlGn,
  interpolateReds,
  interpolateSpectral,
  interpolateTurbo,
  interpolateViridis,
  interpolateYlGnBu,
  interpolateYlOrRd,
} from 'd3'

/**
 * `sequential` runs light to dark (or dark to bright) for amounts; `diverging` has a neutral
 * middle for values either side of a centre; `rainbow` shows detail but has no order a reader
 * can rank, so it is for surfaces, never for amounts.
 */
export type ColorRampKind = 'sequential' | 'diverging' | 'rainbow'
export interface ColorRamp {
  id: string
  label: string
  kind: ColorRampKind
  /** Anchor colours, low to high, as lower-case `#rrggbb`. */
  colors: readonly string[]
}

const ANCHORS = 9
const ramp = (id: string, label: string, kind: ColorRampKind, interpolate: (t: number) => string): ColorRamp => ({
  id,
  label,
  kind,
  colors: Array.from({ length: ANCHORS }, (_, index) => color(interpolate(index / (ANCHORS - 1)))!.formatHex()),
})

export const COLOR_RAMPS: readonly ColorRamp[] = [
  ramp('viridis', 'Viridis', 'sequential', interpolateViridis),
  ramp('plasma', 'Plasma', 'sequential', interpolatePlasma),
  ramp('inferno', 'Inferno', 'sequential', interpolateInferno),
  ramp('magma', 'Magma', 'sequential', interpolateMagma),
  ramp('cividis', 'Cividis', 'sequential', interpolateCividis),
  ramp('ylorrd', 'Yellow–red', 'sequential', interpolateYlOrRd),
  ramp('ylgnbu', 'Yellow–green–blue', 'sequential', interpolateYlGnBu),
  ramp('blues', 'Blues', 'sequential', interpolateBlues),
  ramp('greens', 'Greens', 'sequential', interpolateGreens),
  ramp('oranges', 'Oranges', 'sequential', interpolateOranges),
  ramp('reds', 'Reds', 'sequential', interpolateReds),
  ramp('purples', 'Purples', 'sequential', interpolatePurples),
  ramp('greys', 'Greys', 'sequential', interpolateGreys),
  ramp('rdbu', 'Red–blue', 'diverging', interpolateRdBu),
  ramp('rdylbu', 'Red–yellow–blue', 'diverging', interpolateRdYlBu),
  ramp('rdylgn', 'Red–yellow–green', 'diverging', interpolateRdYlGn),
  ramp('brbg', 'Brown–teal', 'diverging', interpolateBrBG),
  ramp('puor', 'Purple–orange', 'diverging', interpolatePuOr),
  ramp('spectral', 'Spectral', 'diverging', interpolateSpectral),
  ramp('turbo', 'Turbo', 'rainbow', interpolateTurbo),
]

export const COLOR_RAMP_KIND_LABELS: Record<ColorRampKind, string> = {
  sequential: 'Low to high',
  diverging: 'Either side of a middle',
  rainbow: 'Detail, no order',
}

export const colorRamp = (id: string): ColorRamp | undefined => COLOR_RAMPS.find((entry) => entry.id === id)

/** A ramp as a CSS gradient, left (low) to right (high), for a preview. */
export function colorRampCss(colors: readonly string[], reverse = false): string {
  if (colors.length === 0) return 'transparent'
  const ordered = reverse ? [...colors].reverse() : colors
  return `linear-gradient(to right, ${(ordered.length > 1 ? ordered : [ordered[0], ordered[0]]).join(', ')})`
}
