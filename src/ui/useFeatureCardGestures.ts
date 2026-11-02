import { useCallback, useEffect, useRef, type MutableRefObject, type PointerEvent, type RefObject } from 'react'
import type { MobileSheetState } from '../workspace/sheet-math.js'
import { resolveFeatureCardSnap, type FeatureCardHeights } from './feature-card-math.js'
import { readTranslateY } from './motion.js'

interface CardDrag {
  pointerId: number
  target: HTMLElement | null
  startY: number
  startHeight: number
  previousY: number
  previousTime: number
  velocity: number
}

/** A touch on the card body that has not yet been claimed as a drag or a scroll. */
interface BodyTouch {
  id: number
  startX: number
  startY: number
  decided: boolean
}

/** Movement before a body touch is read as a drag or a scroll, as on the controls sheet. */
const BODY_DRAG_SLOP = 10
const BODY_DRAG_IGNORE = 'input,select,textarea,[contenteditable="true"]'

/**
 * The grip and header always drag. The body drags too, with the controls
 * sheet's arbitration: below the full detent any vertical swipe moves the card;
 * at full, a downward swipe moves it only once its content is scrolled to the
 * top, so the content scrolls otherwise. Taps and horizontal swipes are left
 * to the content.
 */
export function useFeatureCardGestures({
  panelRef,
  bodyRef,
  bodyActive = true,
  detent,
  heights,
  disabled,
  movedRef,
  onBringToFront,
  onHeightChange,
  onSnap,
}: {
  panelRef: RefObject<HTMLDivElement | null>
  bodyRef?: RefObject<HTMLElement | null>
  /** Whether the body is mounted; its touch listeners attach when it is. */
  bodyActive?: boolean
  detent?: MobileSheetState
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
    if (drag?.target?.hasPointerCapture?.(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId)
  }, [panelRef])

  useEffect(() => cancelGesture, [cancelGesture])

  /** Starts following the finger from the card's current rendered geometry. */
  const beginDrag = useCallback(
    (pointerId: number, target: HTMLElement | null, clientY: number) => {
      const panel = panelRef.current
      if (!panel) return false
      // Catch the current rendered geometry before removing its in-flight transition.
      const renderedHeight = panel.getBoundingClientRect().height
      const renderedTranslate = readTranslateY(panel)
      panel.style.transition = 'none'
      panel.style.transform = `translateY(${renderedTranslate}px)`
      onHeightChange(renderedHeight, false)
      dragRef.current = {
        pointerId,
        target,
        startY: clientY,
        startHeight: renderedHeight,
        previousY: clientY,
        previousTime: performance.now(),
        velocity: 0,
      }
      panel.dataset.featureCardDragging = 'true'
      return true
    },
    [onHeightChange, panelRef],
  )

  const moveDrag = useCallback(
    (clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const now = performance.now()
      const elapsed = now - drag.previousTime
      if (elapsed > 0) drag.velocity = (clientY - drag.previousY) / elapsed
      drag.previousY = clientY
      drag.previousTime = now
      const delta = clientY - drag.startY
      if (Math.abs(delta) > 4) movedRef.current = true
      onHeightChange(Math.max(heights.collapsed, Math.min(heights.full, drag.startHeight - delta)), false)
    },
    [heights, movedRef, onHeightChange],
  )

  const finishDrag = useCallback(
    (cancelled: boolean) => {
      const drag = dragRef.current
      if (!drag) return
      const panel = panelRef.current
      const renderedHeight = panel?.getBoundingClientRect().height ?? drag.startHeight
      const velocity = cancelled || performance.now() - drag.previousTime > 100 ? 0 : drag.velocity
      cancelGesture()
      // The following click owns a tap on the handle; a header tap just settles back.
      onSnap(resolveFeatureCardSnap(renderedHeight, movedRef.current ? velocity : 0, heights))
    },
    [cancelGesture, heights, movedRef, onSnap, panelRef],
  )

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (disabled || !event.isPrimary || event.button !== 0 || dragRef.current) return
      if (
        (event.target as HTMLElement).closest(
          'button,a,input,select,textarea,[contenteditable="true"],[data-mobile-feature-card-action="true"]',
        )
      )
        return
      if (!beginDrag(event.pointerId, event.currentTarget, event.clientY)) return
      onBringToFront()
      movedRef.current = false
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [beginDrag, disabled, movedRef, onBringToFront],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      moveDrag(event.clientY)
      event.preventDefault()
    },
    [moveDrag],
  )

  const finish = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      finishDrag(event.type === 'pointercancel' || event.type === 'lostpointercapture')
    },
    [finishDrag],
  )

  // Native, non-passive touch listeners on the body: the first vertical move
  // has to be cancellable for the card to claim it before the browser scrolls.
  const latest = useRef({ disabled, detent, beginDrag, moveDrag, finishDrag, movedRef })
  useEffect(() => {
    latest.current = { disabled, detent, beginDrag, moveDrag, finishDrag, movedRef }
  })
  useEffect(() => {
    const body = bodyRef?.current
    if (!body) return
    let touch: BodyTouch | null = null
    // Pointer ids for touches are not exposed on TouchEvent; any id unused by pointer drags will do.
    const touchPointerId = -1

    const scrollableAncestor = (node: EventTarget | null) => {
      for (let el = node instanceof HTMLElement ? node : null; el; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el
        if (el === body) break
      }
      return null
    }
    const findTouch = (list: TouchList, id: number) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i]
      return null
    }

    const onTouchStart = (event: TouchEvent) => {
      const { disabled: off } = latest.current
      if (off || event.touches.length !== 1 || dragRef.current) {
        touch = null
        return
      }
      if ((event.target as HTMLElement | null)?.closest?.(BODY_DRAG_IGNORE)) {
        touch = null
        return
      }
      const t = event.touches[0]
      touch = { id: t.identifier, startX: t.clientX, startY: t.clientY, decided: false }
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!touch) return
      const t = findTouch(event.touches, touch.id)
      if (!t) return
      const { beginDrag: begin, moveDrag: move, detent: current, movedRef: moved } = latest.current
      if (dragRef.current?.pointerId === touchPointerId) {
        if (event.cancelable) event.preventDefault()
        move(t.clientY)
        return
      }
      if (touch.decided) return
      const dx = Math.abs(t.clientX - touch.startX)
      const dy = Math.abs(t.clientY - touch.startY)
      if (dx + dy < BODY_DRAG_SLOP) return
      touch.decided = true
      if (dx > dy || !event.cancelable) return
      const goingDown = t.clientY > touch.startY
      if (current === 'full') {
        if (!goingDown) return
        const scroller = scrollableAncestor(event.target)
        if (scroller && scroller.scrollTop > 0) return
      }
      // Measured from here, so the card does not jump by the slop distance.
      if (!begin(touchPointerId, null, t.clientY)) return
      moved.current = true
      event.preventDefault()
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (!touch || findTouch(event.touches, touch.id)) return
      touch = null
      if (dragRef.current?.pointerId !== touchPointerId) return
      latest.current.finishDrag(event.type === 'touchcancel')
    }

    body.addEventListener('touchstart', onTouchStart, { passive: true })
    body.addEventListener('touchmove', onTouchMove, { passive: false })
    body.addEventListener('touchend', onTouchEnd)
    body.addEventListener('touchcancel', onTouchEnd)
    return () => {
      body.removeEventListener('touchstart', onTouchStart)
      body.removeEventListener('touchmove', onTouchMove)
      body.removeEventListener('touchend', onTouchEnd)
      body.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [bodyActive, bodyRef])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    cancelGesture,
  }
}
