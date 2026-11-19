/**
 * Whether this MapLibre's image source takes decoded pixels in `updateImage({ image })`. It does
 * from 6.18, the version that was read; on anything older `MapImageLayer` encodes the pixels to a
 * data URL instead, which every version takes.
 */
export function imageSourceTakesPixels(version: string | undefined): boolean {
  const [major = 0, minor = 0] = String(version ?? '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  return major > 6 || (major === 6 && minor >= 18)
}
