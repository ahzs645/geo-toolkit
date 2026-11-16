import { useRef, type ReactNode } from 'react'
import { useElementSize } from '../../ui/use-element-size.js'

/**
 * Measure the host's available chart slot. Layout and breakpoint policy belong to the host.
 *
 * The chart is never painted at a height the slot no longer has. The first measurement happens in a layout
 * effect, before the first paint. Later changes, such as a sibling opening below the chart in a flex column,
 * commit inside the ResizeObserver callback, which runs after layout and before paint (`useElementSize`'s
 * `immediate`). A plain `setState`
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
  // Redrawn within the resize, so the chart never shows a stretched frame.
  const measured = useElementSize(ref, { immediate: true, initial: { width: 0, height: initialHeight } }).height
  const height = Math.max(minHeight, Math.floor(measured))
  return (
    <div ref={ref} className={className}>
      {children(height)}
    </div>
  )
}
