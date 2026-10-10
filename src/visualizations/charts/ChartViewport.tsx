import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Measure the host's available chart slot. Layout and breakpoint policy belong to the host. */
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
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const resize = () => setHeight(Math.max(minHeight, Math.floor(element.getBoundingClientRect().height)))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [minHeight])
  return (
    <div ref={ref} className={className}>
      {children(height)}
    </div>
  )
}
