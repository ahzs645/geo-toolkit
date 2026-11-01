import { useLayoutEffect, useState } from 'react'
import { useMediaQuery } from '../workspace/useMediaQuery.js'

/** Shared timing for interface chrome; direct pointer movement never eases. */
export const MOTION_DURATION = { feedback: 150, panel: 350, camera: 350 } as const
export const MOTION_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * Keep exiting content mounted, with a separate visual state for reversible
 * CSS transitions. Callers disable interaction as soon as `open` becomes false.
 * All scheduled work is cancelled when a newer action replaces it.
 */
export function useMotionPresence(open: boolean, duration: number = MOTION_DURATION.panel) {
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState({ open, reducedMotion, present: open, visible: reducedMotion && open })
  // Adjust render state when the requested state changes; effects below only
  // schedule work with the browser, rather than causing a cascading render.
  if (state.open !== open || state.reducedMotion !== reducedMotion) {
    setState({
      open,
      reducedMotion,
      present: reducedMotion ? open : open || state.present,
      visible: open && (reducedMotion || (state.open && state.visible)),
    })
  }

  useLayoutEffect(() => {
    let frame = 0
    let nextFrame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    if (reducedMotion) return
    if (open) {
      // A newly mounted surface must paint its starting state before entry.
      // This effect is cleaned up whenever `open` changes, so it alone decides.
      // Reading `previous.open` instead lost entries: the render-phase update
      // above was not always in the state this updater received, and the
      // desktop table then stayed off screen.
      frame = requestAnimationFrame(() => {
        nextFrame = requestAnimationFrame(() =>
          setState((previous) =>
            previous.visible ? previous : { ...previous, open: true, present: true, visible: true },
          ),
        )
      })
    } else {
      timer = setTimeout(
        () =>
          setState((previous) =>
            previous.present ? { ...previous, open: false, present: false, visible: false } : previous,
          ),
        Math.max(0, duration),
      )
    }
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(nextFrame)
      clearTimeout(timer)
    }
  }, [open, duration, reducedMotion])

  return { present: state.present, visible: state.visible }
}

/** Read the visible position before interrupting a CSS sheet transition. */
export function readTranslateY(element: HTMLElement): number {
  const transform = getComputedStyle(element).transform
  if (!transform || transform === 'none') return 0
  const matrix = new DOMMatrixReadOnly(transform)
  return Number.isFinite(matrix.m42) ? matrix.m42 : 0
}
