/**
 * OKLCH: Oklab as lightness, chroma and hue. Holding `l` fixed while `h` moves gives colours of one
 * visual weight, which is what a ramp or a set of category colours wants. No DOM or network access.
 */
import { gammaDecode, gammaEncode, linearSrgbToOklab, oklabToLinearSrgb } from './okhsv.js'

/** Lightness 0–1, chroma 0 to about 0.4, hue 0–360°. */
export interface Oklch {
  l: number
  c: number
  h: number
}

const EPSILON = 1e-5
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

function oklchToLinear({ l, c, h }: Oklch) {
  const radians = (h * Math.PI) / 180
  return oklabToLinearSrgb(l, c * Math.cos(radians), c * Math.sin(radians))
}

export function hexToOklch(hex: string): Oklch {
  const int = parseInt(hex.replace(/^#/, ''), 16)
  const [l, a, b] = linearSrgbToOklab(
    gammaDecode(((int >> 16) & 255) / 255),
    gammaDecode(((int >> 8) & 255) / 255),
    gammaDecode((int & 255) / 255),
  )
  const c = Math.hypot(a, b)
  return { l, c, h: c < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }
}

/** Whether sRGB can show the colour as given. */
export function isOklchInGamut(color: Oklch): boolean {
  return oklchToLinear(color).every((channel) => channel >= -EPSILON && channel <= 1 + EPSILON)
}

/**
 * OKLCH to lower-case `#rrggbb`. A colour sRGB cannot show has its chroma reduced by bisection,
 * holding lightness and hue, rather than each channel clipped, which would shift the hue.
 */
export function oklchToHex(color: Oklch): string {
  let { c } = color
  if (!isOklchInGamut(color)) {
    let low = 0
    let high = c
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2
      if (isOklchInGamut({ ...color, c: middle })) low = middle
      else high = middle
    }
    c = low
  }
  return `#${oklchToLinear({ ...color, c })
    .map((channel) =>
      Math.round(255 * clamp01(gammaEncode(clamp01(channel))))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}
