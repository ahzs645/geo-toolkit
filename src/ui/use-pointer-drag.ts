import { useCallback, useRef, useState, type PointerEvent, type RefObject } from 'react'

const fraction = (value: number) => Math.min(Math.max(value, 0), 1)

export interface PointerDragHandlers {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onLostPointerCapture: () => void
}

/**
 * Press-and-drag over an element. The pointer is captured, so the drag survives leaving the
 * element, and a mouse button let go outside the window ends it. `onMove` reports each position,
 * the press included, as fractions of the element's box (0–1 from its left and top edges, held at
 * the edges); `onEnd` reports once when the drag is over, which is where a caller commits.
 */
export function usePointerDrag<T extends Element>(
  onMove: (x: number, y: number) => void,
  onEnd?: () => void,
): [RefObject<T>, boolean, PointerDragHandlers] {
  const ref = useRef<T>(null)
  const active = useRef(false)
  const [dragging, setDragging] = useState(false)

  const report = useCallback(
    (event: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect()
      if (!box || box.width === 0 || box.height === 0) return
      onMove(fraction((event.clientX - box.left) / box.width), fraction((event.clientY - box.top) / box.height))
    },
    [onMove],
  )

  const stop = useCallback(() => {
    if (!active.current) return
    active.current = false
    setDragging(false)
    onEnd?.()
  }, [onEnd])

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      event.preventDefault()
      try {
        ref.current?.setPointerCapture(event.pointerId)
      } catch {
        // Capture is best-effort; the drag still works over the element without it.
      }
      ;(ref.current as unknown as HTMLElement | null)?.focus?.({ preventScroll: true })
      active.current = true
      setDragging(true)
      report(event)
    },
    [report],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!active.current) return
      if (event.pointerType === 'mouse' && event.buttons === 0) return stop()
      report(event)
    },
    [report, stop],
  )

  return [
    ref,
    dragging,
    { onPointerDown, onPointerMove, onPointerUp: stop, onPointerCancel: stop, onLostPointerCapture: stop },
  ]
}
