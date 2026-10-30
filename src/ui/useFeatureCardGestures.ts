import { useCallback, useEffect, useRef, type MutableRefObject, type PointerEvent, type RefObject } from 'react'
import type { MobileSheetState } from '../workspace/sheet-math.js'
import { resolveFeatureCardSnap, type FeatureCardHeights } from './feature-card-math.js'
import { readTranslateY } from './motion.js'

interface CardDrag {
  pointerId: number
  target: HTMLElement
  startY: number
  startHeight: number
  previousY: number
  previousTime: number
  velocity: number
}

/** Only the grip/header starts a drag; the body keeps native scrolling and selection. */
export function useFeatureCardGestures({
  panelRef,
  heights,
  disabled,
  movedRef,
  onBringToFront,
  onHeightChange,
  onSnap,
}: {
  panelRef: RefObject<HTMLDivElement | null>
  heights: FeatureCardHeights
  disabled: boolean
  movedRef: MutableRefObject<boolean>
  onBringToFront: () => void
  onHeightChange: (height: number, animate: boolean) => void
  onSnap: (state: MobileSheetState) => void
}) {
  const dragRef = useRef<CardDrag | null>(null)

  const cancelGesture = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (panelRef.current) delete panelRef.current.dataset.featureCardDragging
    if (drag?.target.hasPointerCapture?.(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId)
  }, [panelRef])

  useEffect(() => cancelGesture, [cancelGesture])

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (disabled || !event.isPrimary || event.button !== 0 || dragRef.current) return
      if (
        (event.target as HTMLElement).closest(
          'button,a,input,select,textarea,[contenteditable="true"],[data-mobile-feature-card-action="true"]',
        )
      )
        return
      const panel = panelRef.current
      if (!panel) return
      // Catch the current rendered geometry before removing its in-flight transition.
      const renderedHeight = panel.getBoundingClientRect().height
      const renderedTranslate = readTranslateY(panel)
      panel.style.transition = 'none'
      panel.style.transform = `translateY(${renderedTranslate}px)`
      onHeightChange(renderedHeight, false)
      onBringToFront()
      movedRef.current = false
      dragRef.current = {
        pointerId: event.pointerId,
        target: event.currentTarget,
        startY: event.clientY,
        startHeight: renderedHeight,
        previousY: event.clientY,
        previousTime: performance.now(),
        velocity: 0,
      }
      panel.dataset.featureCardDragging = 'true'
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [disabled, movedRef, onBringToFront, onHeightChange, panelRef],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const now = performance.now()
      const elapsed = now - drag.previousTime
      if (elapsed > 0) drag.velocity = (event.clientY - drag.previousY) / elapsed
      drag.previousY = event.clientY
      drag.previousTime = now
      const delta = event.clientY - drag.startY
      if (Math.abs(delta) > 4) movedRef.current = true
      onHeightChange(Math.max(heights.collapsed, Math.min(heights.full, drag.startHeight - delta)), false)
      event.preventDefault()
    },
    [heights, movedRef, onHeightChange],
  )

  const finish = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const panel = panelRef.current
      const renderedHeight = panel?.getBoundingClientRect().height ?? drag.startHeight
      const cancelled = event.type === 'pointercancel' || event.type === 'lostpointercapture'
      const velocity = cancelled || performance.now() - drag.previousTime > 100 ? 0 : drag.velocity
      cancelGesture()
      // The following click owns a tap on the handle; a header tap just settles back.
      onSnap(resolveFeatureCardSnap(renderedHeight, movedRef.current ? velocity : 0, heights))
    },
    [cancelGesture, heights, movedRef, onSnap, panelRef],
  )

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    cancelGesture,
  }
}
