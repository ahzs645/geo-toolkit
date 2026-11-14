/**
 * Okhsv: a perceptual hue, saturation and value built on Oklab, so equal steps in `s` and `v`
 * read as equal steps. The colour picker's plane and hue rail are drawn in it, which is why its
 * yellows do not crowd and its blues do not sink the way an sRGB HSV plane's do.
 *
 * The Oklab matrices, the gamut cusp and the Okhsv conversion follow Björn Ottosson's "Okhsv and
 * Okhsl" (https://bottosson.github.io/posts/colorpicker/), whose source is MIT licensed:
 * Copyright (c) 2021 Björn Ottosson. See NOTICE-OKHSV.md. No DOM or network access.
 */

/** Hue 0–360°, saturation and value 0–100. */
export interface Okhsv {
  h: number
  s: number
  v: number
}
/** Cusp of the sRGB gamut for a hue, as `[L, C]` in Oklab. */
export type OklabCusp = readonly [number, number]
export type LinearRgb = [number, number, number]

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

/* -------------------------------------------------------------------------- */
/* sRGB transfer                                                              */
/* -------------------------------------------------------------------------- */

/** Linear light -> gamma-encoded sRGB, both 0..1. */
export function gammaEncode(x: number) {
  return x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x
}

/** Gamma-encoded sRGB -> linear light, both 0..1. */
export function gammaDecode(x: number) {
  return x >= 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92
}

/* -------------------------------------------------------------------------- */
/* Oklab <-> linear sRGB                                                      */
/* -------------------------------------------------------------------------- */

export function oklabToLinearSrgb(L: number, a: number, b: number): LinearRgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function linearSrgbToOklab(r: number, g: number, b: number): LinearRgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/* -------------------------------------------------------------------------- */
/* Lightness "toe"                                                            */
/* -------------------------------------------------------------------------- */

const K1 = 0.206
const K2 = 0.03
const K3 = (1 + K1) / (1 + K2)

/** Oklab L -> Okhsl/Okhsv lightness, compensating for Oklab's dark-end toe. */
export function toe(x: number) {
  return 0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) ** 2 + 4 * K2 * K3 * x))
}

export function toeInv(x: number) {
  return (x * x + K1 * x) / (K3 * (x + K2))
}

/* -------------------------------------------------------------------------- */
/* Gamut cusp                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Saturation `S = C/L` where the Oklab hue line `(a, b)` leaves the sRGB gamut.
 * Approximated per channel, then refined with one step of Halley's method.
 */
function computeMaxSaturation(a: number, b: number) {
  let k0: number, k1: number, k2: number, k3: number, k4: number
  let wl: number, wm: number, ws: number

  if (-1.88170328 * a - 0.80936493 * b > 1) {
    // Red component is the limiting one.
    k0 = 1.19086277
    k1 = 1.76576728
    k2 = 0.59662641
    k3 = 0.75515197
    k4 = 0.56771245
    wl = 4.0767416621
    wm = -3.3077115913
    ws = 0.2309699292
  } else if (1.81444104 * a - 1.19445276 * b > 1) {
    // Green.
    k0 = 0.73956515
    k1 = -0.45954404
    k2 = 0.08285427
    k3 = 0.1254107
    k4 = 0.14503204
    wl = -1.2684380046
    wm = 2.6097574011
    ws = -0.3413193965
  } else {
    // Blue.
    k0 = 1.35733652
    k1 = -0.00915799
    k2 = -1.1513021
    k3 = -0.50559606
    k4 = 0.00692167
    wl = -0.0041960863
    wm = -0.7034186147
    ws = 1.707614701
  }

  const S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b

  const kl = 0.3963377774 * a + 0.2158037573 * b
  const km = -0.1055613458 * a - 0.0638541728 * b
  const ks = -0.0894841775 * a - 1.291485548 * b

  const lRoot = 1 + S * kl
  const mRoot = 1 + S * km
  const sRoot = 1 + S * ks

  const f = wl * lRoot ** 3 + wm * mRoot ** 3 + ws * sRoot ** 3
  const f1 = 3 * (wl * kl * lRoot ** 2 + wm * km * mRoot ** 2 + ws * ks * sRoot ** 2)
  const f2 = 6 * (wl * kl * kl * lRoot + wm * km * km * mRoot + ws * ks * ks * sRoot)

  return S - (f * f1) / (f1 * f1 - 0.5 * f * f2)
}

/** Brightest, most saturated point of the sRGB gamut on a hue line. */
export function findCusp(a: number, b: number): OklabCusp {
  const S = computeMaxSaturation(a, b)
  const [r, g, bl] = oklabToLinearSrgb(1, S * a, S * b)
  const L = Math.cbrt(1 / Math.max(r, g, bl))
  return [L, L * S]
}

/** Memoised `findCusp` over 1024 hue buckets — the wheel needs one per pixel. */
const cuspCache = new Float64Array(2048)
const cuspSeen = new Uint8Array(1024)

export function cuspForHue(hue01: number): OklabCusp {
  const bucket = Math.min(1023, Math.floor((((hue01 % 1) + 1) % 1) * 1024))
  if (!cuspSeen[bucket]) {
    const angle = (2 * Math.PI * (bucket + 0.5)) / 1024
    const [L, C] = findCusp(Math.cos(angle), Math.sin(angle))
    cuspCache[2 * bucket] = L
    cuspCache[2 * bucket + 1] = C
    cuspSeen[bucket] = 1
  }
  return [cuspCache[2 * bucket], cuspCache[2 * bucket + 1]]
}

/* -------------------------------------------------------------------------- */
/* Okhsv <-> sRGB                                                             */
/* -------------------------------------------------------------------------- */

const S0 = 0.5

/**
 * Okhsv -> linear sRGB. Inputs are normalised (h, s, v all 0..1); pass a
 * pre-computed `cusp` when converting many pixels of the same hue.
 */
export function okhsvToLinearSrgb(h: number, s: number, v: number, cusp?: OklabCusp): LinearRgb {
  if (v <= 0) return [0, 0, 0]

  const a = Math.cos(2 * Math.PI * h)
  const b = Math.sin(2 * Math.PI * h)
  const [cuspL, cuspC] = cusp ?? findCusp(a, b)

  const sMax = cuspC / cuspL
  const tMax = cuspC / (1 - cuspL)
  const k = 1 - S0 / sMax

  // Treat the gamut slice as a triangle first...
  const denom = S0 + tMax - tMax * k * s
  const Lv = 1 - (s * S0) / denom
  const Cv = (s * tMax * S0) / denom

  let L = v * Lv
  let C = v * Cv

  // ...then correct for the toe and for the rounded top of the real gamut.
  const Lvt = toeInv(Lv)
  const Cvt = (Cv * Lvt) / Lv

  const Lnew = toeInv(L)
  C = (C * Lnew) / L
  L = Lnew

  const [sr, sg, sb] = oklabToLinearSrgb(Lvt, a * Cvt, b * Cvt)
  const scale = Math.cbrt(1 / Math.max(sr, sg, sb, 0))

  L *= scale
  C *= scale

  return oklabToLinearSrgb(L, C * a, C * b)
}

const to255 = (linear: number) => Math.round(255 * clamp01(gammaEncode(linear)))

/** Okhsv to lower-case `#rrggbb`. */
export function okhsvToHex({ h, s, v }: Okhsv): string {
  return `#${okhsvToLinearSrgb((((h % 360) + 360) % 360) / 360, clamp01(s / 100), clamp01(v / 100))
    .map((channel) => to255(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

/** `#rrggbb` to Okhsv. Greys and black have no hue of their own and report 0. */
export function hexToOkhsv(hex: string): Okhsv {
  const int = parseInt(hex.replace(/^#/, ''), 16)
  const r = gammaDecode(((int >> 16) & 255) / 255)
  const g = gammaDecode(((int >> 8) & 255) / 255)
  const b = gammaDecode((int & 255) / 255)

  const [L, oa, ob] = linearSrgbToOklab(r, g, b)
  if (!(L > 1e-6)) return { h: 0, s: 0, v: 0 }

  const C = Math.hypot(oa, ob)
  if (C < 1e-6) return { h: 0, s: 0, v: 100 * clamp01(toe(L)) }

  const aNorm = oa / C
  const bNorm = ob / C
  const hue = (Math.atan2(ob, oa) / (2 * Math.PI) + 1) % 1

  const [cuspL, cuspC] = findCusp(aNorm, bNorm)
  const sMax = cuspC / cuspL
  const tMax = cuspC / (1 - cuspL)
  const k = 1 - S0 / sMax

  const t = tMax / (C + L * tMax)
  const Lv = t * L
  const Cv = t * C

  const Lvt = toeInv(Lv)
  const Cvt = (Cv * Lvt) / Lv

  const [sr, sg, sb] = oklabToLinearSrgb(Lvt, aNorm * Cvt, bNorm * Cvt)
  const scale = Math.cbrt(1 / Math.max(sr, sg, sb, 0))

  return {
    h: 360 * hue,
    s: 100 * clamp01(((S0 + tMax) * Cv) / (tMax * S0 + tMax * k * Cv)),
    v: 100 * clamp01(toe(L / scale) / Lv),
  }
}

export const OKHSV_SWATCH_HUES = [12, 68, 128, 178, 232, 292] as const
export const OKHSV_SWATCH_STEPS = [
  { s: 22, v: 96 },
  { s: 44, v: 88 },
  { s: 68, v: 78 },
  { s: 88, v: 64 },
  { s: 92, v: 46 },
] as const

/**
 * A swatch grid generated in Okhsv rather than picked by hand: one column a hue, one row a fixed
 * saturation and value step, so each row reads as one weight across every hue. Returned row by row
 * (lightest first), then a row of neutrals from white to black.
 */
export function okhsvSwatches(
  hues: readonly number[] = OKHSV_SWATCH_HUES,
  steps: readonly { s: number; v: number }[] = OKHSV_SWATCH_STEPS,
): string[] {
  const neutrals = hues.map((_, index) => okhsvToHex({ h: 0, s: 0, v: 100 - (100 * index) / (hues.length - 1 || 1) }))
  return [...steps.flatMap(({ s, v }) => hues.map((h) => okhsvToHex({ h, s, v }))), ...neutrals]
}
