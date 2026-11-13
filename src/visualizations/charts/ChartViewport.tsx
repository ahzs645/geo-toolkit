import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

/**
 * Measure the host's available chart slot. Layout and breakpoint policy belong to the host.
 *
 * The chart is never painted at a height the slot no longer has. The first measurement happens in a layout
 * effect, before the first paint. Later changes, such as a sibling opening below the chart in a flex column,
 * commit inside the ResizeObserver callback, which runs after layout and before paint. A plain `setState`
 * there renders in a later task. The browser then paints the old height first: an open footer covers the
 * plot's bottom, a folded one leaves it half empty, and that frame stays up for as long as a heavy chart
 * takes to render.
 */
export function ChartViewport({
  children,
  className,
  minHeight = 100,
  initialHeight = 260,
}: {
  children: (height: number) => ReactNode
  className?: string
  minHeight?: number
  initialHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(initialHeight)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => Math.max(minHeight, Math.floor(element.getBoundingClientRect().height))
    setHeight(measure())
    const observer = new ResizeObserver(() => flushSync(() => setHeight(measure())))
    observer.observe(element)
    return () => observer.disconnect()
  }, [minHeight])
  return (
    <div ref={ref} className={className}>
      {children(height)}
    </div>
  )
}
