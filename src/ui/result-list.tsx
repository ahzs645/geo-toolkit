import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../utils.js'
import { InlineAlert } from './map-panels.js'
import { TextButton } from './text-button.js'
import { formatNumber } from '../format/index.js'

export type ResultRowAccent = 'sky' | 'green' | 'cyan' | 'amber' | 'violet' | 'orange' | 'rose' | 'teal'

// Selected rows get a tint plus a thin inset outline (not an accent stripe), so selection does not
// rely on the fill's colour alone.
const selectedClasses: Record<ResultRowAccent, string> = {
  sky: 'bg-sky-50 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/30 dark:ring-sky-800',
  green: 'bg-green-50 ring-1 ring-inset ring-green-300 dark:bg-green-950/30 dark:ring-green-800',
  cyan: 'bg-cyan-50 ring-1 ring-inset ring-cyan-300 dark:bg-cyan-950/30 dark:ring-cyan-800',
  amber: 'bg-amber-50 ring-1 ring-inset ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-800',
  violet: 'bg-violet-50 ring-1 ring-inset ring-violet-300 dark:bg-violet-950/30 dark:ring-violet-800',
  orange: 'bg-orange-50 ring-1 ring-inset ring-orange-300 dark:bg-orange-950/30 dark:ring-orange-800',
  rose: 'bg-rose-50 ring-1 ring-inset ring-rose-300 dark:bg-rose-950/30 dark:ring-rose-800',
  teal: 'bg-teal-50 ring-1 ring-inset ring-teal-300 dark:bg-teal-950/30 dark:ring-teal-800',
}

// A selected row's detail continues its outline down the sides and along the bottom, so the two read
// as one box.
const selectedDetailClasses: Record<ResultRowAccent, string> = {
  sky: 'bg-sky-50 shadow-[inset_1px_0_0_theme(colors.sky.300),inset_-1px_-1px_0_theme(colors.sky.300)] dark:bg-sky-950/30 dark:shadow-[inset_1px_0_0_theme(colors.sky.800),inset_-1px_-1px_0_theme(colors.sky.800)]',
  green:
    'bg-green-50 shadow-[inset_1px_0_0_theme(colors.green.300),inset_-1px_-1px_0_theme(colors.green.300)] dark:bg-green-950/30 dark:shadow-[inset_1px_0_0_theme(colors.green.800),inset_-1px_-1px_0_theme(colors.green.800)]',
  cyan: 'bg-cyan-50 shadow-[inset_1px_0_0_theme(colors.cyan.300),inset_-1px_-1px_0_theme(colors.cyan.300)] dark:bg-cyan-950/30 dark:shadow-[inset_1px_0_0_theme(colors.cyan.800),inset_-1px_-1px_0_theme(colors.cyan.800)]',
  amber:
    'bg-amber-50 shadow-[inset_1px_0_0_theme(colors.amber.300),inset_-1px_-1px_0_theme(colors.amber.300)] dark:bg-amber-950/30 dark:shadow-[inset_1px_0_0_theme(colors.amber.800),inset_-1px_-1px_0_theme(colors.amber.800)]',
  violet:
    'bg-violet-50 shadow-[inset_1px_0_0_theme(colors.violet.300),inset_-1px_-1px_0_theme(colors.violet.300)] dark:bg-violet-950/30 dark:shadow-[inset_1px_0_0_theme(colors.violet.800),inset_-1px_-1px_0_theme(colors.violet.800)]',
  orange:
    'bg-orange-50 shadow-[inset_1px_0_0_theme(colors.orange.300),inset_-1px_-1px_0_theme(colors.orange.300)] dark:bg-orange-950/30 dark:shadow-[inset_1px_0_0_theme(colors.orange.800),inset_-1px_-1px_0_theme(colors.orange.800)]',
  rose: 'bg-rose-50 shadow-[inset_1px_0_0_theme(colors.rose.300),inset_-1px_-1px_0_theme(colors.rose.300)] dark:bg-rose-950/30 dark:shadow-[inset_1px_0_0_theme(colors.rose.800),inset_-1px_-1px_0_theme(colors.rose.800)]',
  teal: 'bg-teal-50 shadow-[inset_1px_0_0_theme(colors.teal.300),inset_-1px_-1px_0_theme(colors.teal.300)] dark:bg-teal-950/30 dark:shadow-[inset_1px_0_0_theme(colors.teal.800),inset_-1px_-1px_0_theme(colors.teal.800)]',
}

const focusClasses: Record<ResultRowAccent, string> = {
  sky: 'focus-visible:ring-sky-500',
  green: 'focus-visible:ring-green-500',
  cyan: 'focus-visible:ring-cyan-500',
  amber: 'focus-visible:ring-amber-500',
  violet: 'focus-visible:ring-violet-500',
  orange: 'focus-visible:ring-orange-500',
  rose: 'focus-visible:ring-rose-500',
  teal: 'focus-visible:ring-teal-500',
}

type ResultRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  title: ReactNode
  subtitle?: ReactNode
  /** Extra lines under the subtitle: badges, counts, a type label. */
  meta?: ReactNode
  /** Left marker: pass `dotColor` for a plain dot, or any node. */
  leading?: ReactNode
  dotColor?: string
  /** Right-hand value, e.g. a reading or a score. */
  trailing?: ReactNode
  selected?: boolean
  accent?: ResultRowAccent
}

/**
 * One row of a sidebar result list: marker, title, subtitle, meta, and an
 * optional value on the right. A button with aria-pressed so keyboard and
 * screen-reader users can tell which row is selected.
 */
export function ResultRow({
  title,
  subtitle,
  meta,
  leading,
  dotColor,
  trailing,
  selected = false,
  accent = 'sky',
  className,
  type = 'button',
  ...props
}: ResultRowProps) {
  const marker =
    leading ??
    (dotColor ? (
      <span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: dotColor }} />
    ) : null)

  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset dark:hover:bg-slate-800/60',
        focusClasses[accent],
        selected && selectedClasses[accent],
        className,
      )}
      {...props}
    >
      {marker && <span className="shrink-0">{marker}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
        {meta && <span className="mt-1 block text-xs text-muted-foreground">{meta}</span>}
      </span>
      {trailing && (
        <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{trailing}</span>
      )}
    </button>
  )
}

/**
 * Detail shown under a selected `ResultRow`, in the same list item. It carries
 * the row's tint and left bar on, so the two read as one selected item, and
 * lines its content up with the row's title. Assumes the row has a marker.
 */
export function ResultRowDetail({
  accent = 'sky',
  className,
  children,
}: {
  accent?: ResultRowAccent
  className?: string
  children: ReactNode
}) {
  return <div className={cn('pb-3 pl-8 pr-3 text-xs', selectedDetailClasses[accent], className)}>{children}</div>
}

type ListHeaderProps = {
  count: number
  /** Noun for the items, e.g. `['station', 'stations']`. */
  noun: readonly [string, string]
  /** How many rows are rendered when the list is capped; shows "showing first N". */
  shown?: number
  /** Anything else for the right side (a hint, a sort control). */
  aside?: ReactNode
  sticky?: boolean
  className?: string
}

/** "N items" line above a result list, sticky by default so it stays as the list scrolls. */
export function ListHeader({ count, noun, shown, aside, sticky = true, className }: ListHeaderProps) {
  const capped = shown != null && shown < count
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur',
        sticky && 'sticky top-0 z-10',
        className,
      )}
      aria-live="polite"
    >
      <span>
        {formatNumber(count)} {count === 1 ? noun[0] : noun[1]}
        {capped && ` · showing first ${formatNumber(shown)}`}
      </span>
      {aside}
    </div>
  )
}

type ListStateProps = {
  loading?: boolean
  loadingLabel?: string
  error?: string | null
  errorTitle?: string
  empty?: boolean
  emptyLabel?: ReactNode
  /** Offer a way out of an empty result, e.g. reset filters. */
  onReset?: () => void
  resetLabel?: string
  children?: ReactNode
  className?: string
}

/**
 * Loading, error and empty handling for a result list, the same everywhere.
 * Renders `children` (the list) unless loading or failed.
 */
export function ListState({
  loading = false,
  loadingLabel = 'Loading...',
  error,
  errorTitle = 'Could not load data',
  empty = false,
  emptyLabel = 'Nothing matches these filters.',
  onReset,
  resetLabel = 'Reset filters',
  children,
  className,
}: ListStateProps) {
  if (loading) {
    return (
      <div
        className={cn('flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground', className)}
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {loadingLabel}
      </div>
    )
  }
  if (error) {
    return (
      <div className={cn('p-3', className)}>
        <InlineAlert tone="error" title={errorTitle}>
          {error}
        </InlineAlert>
      </div>
    )
  }
  return (
    <>
      {empty && (
        <div className={cn('space-y-2 p-4 text-sm text-muted-foreground', className)}>
          <p>{emptyLabel}</p>
          {onReset && <TextButton onClick={onReset}>{resetLabel}</TextButton>}
        </div>
      )}
      {children}
    </>
  )
}

/** A small "nothing here yet" note inside a panel or tab (not a whole dialog body). */
export function EmptyHint({
  children,
  variant = 'dashed',
  className,
}: {
  children: ReactNode
  variant?: 'dashed' | 'plain'
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-4 text-center text-xs text-muted-foreground',
        variant === 'dashed' && 'border border-dashed border-border',
        className,
      )}
    >
      {children}
    </div>
  )
}
