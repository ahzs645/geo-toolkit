import { useCallback, useSyncExternalStore } from 'react'

interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>
}
type EyeDropperConstructor = new () => EyeDropperLike

const subscribe = () => () => {}
const browserEyeDropper = () => (globalThis as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper ?? null
const noEyeDropper = () => null

/**
 * A callback that lets the person pick a colour from anywhere on the screen, or `null` where the
 * browser has no EyeDropper (it is Chromium only, in secure contexts), so the caller can leave
 * the button out. A cancelled pick reports nothing.
 */
export function useEyeDropper(onPick: (hex: string) => void): (() => void) | null {
  const EyeDropper = useSyncExternalStore(subscribe, browserEyeDropper, noEyeDropper)
  const pick = useCallback(() => {
    if (!EyeDropper) return
    new EyeDropper()
      .open()
      .then((result) => onPick(result.sRGBHex))
      .catch(() => {})
  }, [EyeDropper, onPick])
  return EyeDropper ? pick : null
}
