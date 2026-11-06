import type { ElementType, ReactNode } from 'react'

import { cn } from '../utils.js'

export type ToolPageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** Short category line above the title. */
  eyebrow?: ReactNode
  eyebrowIcon?: ElementType
  eyebrowClassName?: string
  /** The way back, placed above everything else. */
  back?: ReactNode
  /** Right-aligned status, such as a "Runs in your browser" badge. */
  aside?: ReactNode
  /** 'lg' for a hub page that lists tools, matching the map library's heading. */
  size?: 'md' | 'lg'
  className?: string
}

/** The head of a tool that is a scrolling page rather than a map with a sidebar. */
export function ToolPageHeader({
  title,
  description,
  eyebrow,
  eyebrowIcon: Icon,
  eyebrowClassName,
  back,
  aside,
  size = 'md',
  className,
}: ToolPageHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      {back}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && (
            <div className={cn('mb-1 flex items-center gap-1.5 text-xs font-medium', eyebrowClassName)}>
              {Icon && <Icon className="size-4" aria-hidden="true" />}
              {eyebrow}
            </div>
          )}
          <h1 className={cn('font-bold tracking-tight', size === 'lg' ? 'text-3xl sm:text-5xl' : 'text-2xl')}>
            {title}
          </h1>
          {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        {aside && <div className="shrink-0 self-start">{aside}</div>}
      </header>
    </div>
  )
}
