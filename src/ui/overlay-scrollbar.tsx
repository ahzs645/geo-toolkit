import { useEffect, useRef, type RefObject } from 'react'

const HIDE_AFTER = 900 // ms of stillness before the thumb fades out
const MIN_THUMB = 32

/**
 * A thin scrollbar drawn over a scrolling element instead of beside it, the same on every
 * platform and taking no width from the content.
 *
 * Give the scroller the `geo-overlay-scroll` class (hides the native bar) and render the returned
 * element as its sibling inside a positioned container. `MapSidebarShell` does both. The thumb follows the scroll position,
 * fades in while scrolling or while a mouse is over the container, and can be dragged with mouse,
 * pen or touch. Everything is updated through refs, so scrolling never re-renders React.
 */
export function useOverlayScrollbar(scrollRef: RefObject<HTMLElement>, enabled = true) {
  const track = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    const tr = track.current
    const th = thumb.current
    if (!enabled || !el || !tr || !th) return
    let hideTimer = 0
    let hovering = false
    let drag: { id: number; startY: number; startTop: number } | null = null
    let frame = 0

    const layout = () => {
      frame = 0
      const view = el.clientHeight
      const full = el.scrollHeight
      tr.style.top = `${el.offsetTop}px`
      tr.style.height = `${view}px`
      if (full <= view + 1) {
        tr.hidden = true
        return
      }
      tr.hidden = false
      const size = Math.max(MIN_THUMB, (view * view) / full)
      const room = view - size
      const top = (el.scrollTop / (full - view)) * room
      th.style.height = `${size}px`
      th.style.transform = `translateY(${Math.min(room, Math.max(0, top))}px)`
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout)
    }
    const show = () => {
      tr.dataset.active = 'true'
      clearTimeout(hideTimer)
      if (!hovering && !drag) hideTimer = window.setTimeout(() => delete tr.dataset.active, HIDE_AFTER)
    }
    const onScroll = () => {
      schedule()
      show()
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation() // a drag of the thumb scrolls; it never moves a sheet or resizes a pane
      th.setPointerCapture(e.pointerId)
      drag = { id: e.pointerId, startY: e.clientY, startTop: el.scrollTop }
      tr.dataset.dragging = 'true'
      show()
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const view = el.clientHeight
      const size = th.offsetHeight
      const ratio = (el.scrollHeight - view) / Math.max(1, view - size)
      el.scrollTop = drag.startTop + (e.clientY - drag.startY) * ratio
    }
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      drag = null
      delete tr.dataset.dragging
      show()
    }

    // Mouse only: on touch screens, "hover" would stick after a tap.
    const host = tr.parentElement
    const enter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      hovering = true
      layout()
      show()
    }
    const leave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      hovering = false
      show()
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    th.addEventListener('pointerdown', onDown)
    th.addEventListener('pointermove', onMove)
    th.addEventListener('pointerup', onUp)
    th.addEventListener('pointercancel', onUp)
    host?.addEventListener('pointerenter', enter)
    host?.addEventListener('pointerleave', leave)
    // Content loads in (images, charts) and the sheet changes height on mobile.
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    const mo = new MutationObserver(() => {
      for (const c of Array.from(el.children)) ro.observe(c)
      schedule()
    })
    mo.observe(el, { childList: true })
    for (const c of Array.from(el.children)) ro.observe(c)
    layout()

    return () => {
      clearTimeout(hideTimer)
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
      th.removeEventListener('pointerdown', onDown)
      th.removeEventListener('pointermove', onMove)
      th.removeEventListener('pointerup', onUp)
      th.removeEventListener('pointercancel', onUp)
      host?.removeEventListener('pointerenter', enter)
      host?.removeEventListener('pointerleave', leave)
      ro.disconnect()
      mo.disconnect()
    }
  }, [scrollRef, enabled])

  if (!enabled) return null
  return (
    <div className="geo-overlay-scrollbar" data-overlay-scrollbar="true" ref={track} aria-hidden="true" hidden>
      <div className="geo-overlay-scrollbar-thumb" ref={thumb} />
    </div>
  )
}
