import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../utils.js'

/** A single row at the supplied container width; narrow embeds wrap without depending on the viewport. */
export function DashboardToolbar({
  title,
  children,
  className,
  label = 'Page controls',
  inlineAt = 1000,
}: {
  title: string
  children: ReactNode
  className?: string
  label?: string
  inlineAt?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inline, setInline] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const resize = () => setInline(element.getBoundingClientRect().width >= inlineAt)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [inlineAt])
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-inline={inline}
      className={cn('flex items-center justify-between gap-2', inline ? 'flex-nowrap' : 'flex-wrap', className)}
    >
      <h1
        className={cn(
          'min-w-0 font-bold tracking-tight text-foreground',
          inline ? 'flex-1 truncate text-sm' : 'text-lg',
        )}
        title={title}
      >
        {title}
      </h1>
      <div className={cn('flex items-center gap-2', inline ? 'shrink-0 flex-nowrap' : 'flex-wrap')}>{children}</div>
    </div>
  )
}
