import { readTranslateY } from '../ui/motion.js'

interface SheetMotionOptions {
  durationMs: number
  easing: string
  onFrame: (translateY: number) => void
  read?: (element: HTMLElement) => number
  requestFrame?: typeof requestAnimationFrame
  cancelFrame?: typeof cancelAnimationFrame
  now?: () => number
}

/** Retarget a CSS transition from its rendered position and report its real geometry. */
export function moveSheet(
  element: HTMLElement,
  targetY: number,
  {
    durationMs,
    easing,
    onFrame,
    read = readTranslateY,
    requestFrame = requestAnimationFrame,
    cancelFrame = cancelAnimationFrame,
    now = () => performance.now(),
  }: SheetMotionOptions,
): () => void {
  // Read before removing the transition: its inline transform contains the old
  // destination, which may still be hundreds of pixels from the drawn sheet.
  const renderedY = read(element)
  element.style.transition = 'none'
  element.style.transform = `translateY(${renderedY}px)`

  if (durationMs <= 0 || Math.abs(renderedY - targetY) < 0.01) {
    element.style.transform = `translateY(${targetY}px)`
    element.style.willChange = ''
    onFrame(targetY)
    return () => {}
  }

  // Commit the starting transform, including a programmatically supplied start
  // height, before setting the next destination in the same browser frame.
  element.getBoundingClientRect()
  element.style.willChange = 'transform'
  element.style.transition = `transform ${durationMs}ms ${easing}`
  element.style.transform = `translateY(${targetY}px)`
  onFrame(renderedY)

  let stopped = false
  let frame: number | undefined
  const startedAt = now()
  const cancel = () => {
    stopped = true
    if (frame !== undefined) cancelFrame(frame)
    element.removeEventListener('transitionend', onEnd)
    element.style.willChange = ''
  }
  const finish = () => {
    if (stopped) return
    cancel()
    onFrame(targetY)
  }
  const onEnd = (event: TransitionEvent) => {
    // Cancelling the previous CSS transition can queue its end/cancel events
    // after this new transition starts. Never let an earlier event settle it.
    if (event.target === element && event.propertyName === 'transform' && now() - startedAt >= durationMs - 16) {
      finish()
    }
  }
  const update = () => {
    if (stopped) return
    if (now() - startedAt >= durationMs + 50) {
      // transitionend is not guaranteed when the page was backgrounded.
      finish()
      return
    }
    onFrame(read(element))
    frame = requestFrame(update)
  }
  element.addEventListener('transitionend', onEnd)
  frame = requestFrame(update)
  return cancel
}
