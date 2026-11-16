import { useRef, type ReactNode } from 'react'
import { cn } from '../utils.js'
import { useElementSize } from './use-element-size.js'
import { useSizeFold } from './use-size-fold.js'

const TOOLBAR_FOLD_GAP_PX = 16

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
  // One row from `inlineAt`; once there it keeps the row until 16 px narrower (its title truncates), so a
  // width on the line does not switch the toolbar back and forth (`useSizeFold`).
  const wrapped = useSizeFold(
    useElementSize(ref).width,
    { foldBelow: inlineAt - TOOLBAR_FOLD_GAP_PX, unfoldFrom: inlineAt },
    true,
  )
  const inline = !wrapped
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
