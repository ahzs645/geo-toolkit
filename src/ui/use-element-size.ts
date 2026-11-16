import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

/**
 * An element's measured size, kept in state (API.md, **Measured sizes and folds**). One hook for
 * every "observe this element and re-render at its size" job, so each gets the same rules: measured
 * before the first paint, no re-render when the size has not changed, and a hidden element (0 × 0,
 * `display: none` or detached) keeps its last size rather than collapsing what is drawn at it.
 *
 * A layout that switches on a size (folds, wraps, hides a caption) takes `useSizeFold` on top: a
 * switch that changes the measured size flips back and forth on its own without it.
 */
export interface ElementSize {
  width: number
  height: number
}

export interface ElementSizeOptions {
  /**
   * `border` (the default): the box the element takes on screen, `getBoundingClientRect`.
   * `content`: inside its padding and scrollbar, ResizeObserver's `contentRect`.
   */
  box?: 'border' | 'content'
  /** The size reported before the element is measured. */
  initial?: ElementSize
  /** Which measurements to keep. The default keeps all but 0 × 0. */
  accept?: (size: ElementSize) => boolean
  /**
   * Re-render inside the resize itself (`flushSync`), so a canvas or SVG drawn at the size never
   * shows one stretched frame. Costs a synchronous render per resize: only for drawings.
   */
  immediate?: boolean
}

export const UNMEASURED: ElementSize = { width: 0, height: 0 }

const shown = (size: ElementSize) => size.width > 0 || size.height > 0

/** The element's size in the given box. */
export function measureElementSize(element: Element, box: 'border' | 'content' = 'border'): ElementSize {
  if (box === 'content' && typeof HTMLElement !== 'undefined' && element instanceof HTMLElement) {
    const style = getComputedStyle(element)
    const padding = (start: string, end: string) =>
      (parseFloat(style.getPropertyValue(start)) || 0) + (parseFloat(style.getPropertyValue(end)) || 0)
    return {
      width: Math.max(0, element.clientWidth - padding('padding-left', 'padding-right')),
      height: Math.max(0, element.clientHeight - padding('padding-top', 'padding-bottom')),
    }
  }
  // An SVG or other non-HTML element has no padding box of its own to subtract.
  const rect = element.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

/**
 * The size of `target`, a ref or the element itself (for an element the page does not render,
 * such as a map's container). A ref is read when the component mounts, as `useEffect` reads one.
 */
export function useElementSize(
  target: RefObject<Element | null> | Element | null | undefined,
  { box = 'border', initial = UNMEASURED, accept = shown, immediate = false }: ElementSizeOptions = {},
): ElementSize {
  const [size, setSize] = useState(initial)
  const acceptRef = useRef(accept)
  const sizeRef = useRef(size)
  useLayoutEffect(() => {
    acceptRef.current = accept
  })
  useLayoutEffect(() => {
    const element = target && 'current' in target ? target.current : target
    if (!element) return
    const measure = (flush: boolean) => {
      const next = measureElementSize(element, box)
      const last = sizeRef.current
      // An unchanged size sets nothing, so it costs no render at all.
      if (!acceptRef.current(next) || (last.width === next.width && last.height === next.height)) return
      sizeRef.current = next
      if (flush) flushSync(() => setSize(next))
      else setSize(next)
    }
    // Measured now as well, so the first paint is drawn at the element's size.
    measure(false)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure(immediate))
    observer.observe(element)
    return () => observer.disconnect()
  }, [target, box, immediate])
  return size
}
