import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils.js'

export interface ShareBarSeries {
  /** Prefix in the value text when there is more than one series ("A", "B"). */
  label?: ReactNode
  /** Fill class for the bar, e.g. `bg-emerald-600`. Ignored when `color` is set. */
  className?: string
  /** Fill colour for the bar, for a colour outside the class palette. */
  color?: string
}

export interface ShareBarItem {
  key?: string
  label: ReactNode
  /** One value per series. `null` draws an empty bar. */
  values: readonly (number | null | undefined)[]
  /** Replaces the formatted value text. */
  display?: ReactNode
}

export type ShareBarsProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> & {
  items: readonly ShareBarItem[]
  /** Defaults to a single primary series. */
  series?: readonly ShareBarSeries[]
  /** `inline` puts label, bar and value on one row; `stacked` puts the bars under the label and value. */
  layout?: 'inline' | 'stacked'
  /** The value a full bar stands for. Defaults to 100, for percentages. */
  max?: number
  formatValue?: (value: number) => ReactNode
  /** Width of the label column in the `inline` layout. */
  labelWidth?: string
  /**
   * Makes each row a toggle button that filters by its `key`: clicking a row
   * selects it, clicking the selected row again clears the filter (`null`).
   * Rows without a `key` stay plain.
   */
  onSelect?: (key: string | null) => void
  /** The selected row's `key`; the other rows are dimmed while one is selected. */
  selectedKey?: string | null
}

const DEFAULT_SERIES: readonly ShareBarSeries[] = [{}]
const percent = (value: number) => `${value.toFixed(1)}%`

/**
 * Each row's share as a bar: a distribution across bins, or one item compared
 * between two or more series. Values are drawn against `max`, never against the
 * largest row, so bars from different lists can be read against each other.
 */
export function ShareBars({
  items,
  series = DEFAULT_SERIES,
  layout = 'inline',
  max = 100,
  formatValue = percent,
  labelWidth = '3.25rem',
  onSelect,
  selectedKey = null,
  className,
  ...props
}: ShareBarsProps) {
  const width = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value) || max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  const text = (item: ShareBarItem) =>
    item.display ??
    series.map((entry, index) => {
      const value = item.values[index]
      return (
        <span key={index}>
          {index > 0 && ' · '}
          {entry.label != null && <>{entry.label} </>}
          {value == null ? '–' : formatValue(value)}
        </span>
      )
    })
  const bar = (item: ShareBarItem, index: number, entry: ShareBarSeries) => (
    <span key={index} className="block h-1.5 overflow-hidden rounded bg-muted">
      <span
        className={cn('block h-full rounded', !entry.color && (entry.className ?? 'bg-primary'))}
        style={{ width: `${width(item.values[index])}%`, backgroundColor: entry.color }}
      />
    </span>
  )
  return (
    <div className={cn('space-y-2 text-3xs', className)} {...props}>
      {items.map((item, row) => {
        const selectable = onSelect != null && item.key != null
        const selected = selectable && item.key === selectedKey
        const Row = selectable ? 'button' : 'div'
        const rowProps = selectable
          ? {
              type: 'button' as const,
              'aria-pressed': selected,
              onClick: () => onSelect(selected ? null : item.key!),
              className: cn(
                '-mx-1 w-[calc(100%+0.5rem)] rounded px-1 py-0.5 text-left transition-opacity hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                selected && 'bg-muted font-medium text-foreground',
                selectedKey != null && !selected && 'opacity-50 hover:opacity-100',
              ),
            }
          : { className: undefined }
        return layout === 'inline' ? (
          <Row
            key={item.key ?? row}
            {...rowProps}
            className={cn('grid items-center gap-2', rowProps.className)}
            style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr) auto` }}
          >
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="space-y-0.5">{series.map((entry, index) => bar(item, index, entry))}</span>
            <span className="text-right tabular-nums">{text(item)}</span>
          </Row>
        ) : (
          <Row key={item.key ?? row} {...rowProps} className={cn(selectable && 'block', rowProps.className)}>
            <span className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 tabular-nums">{text(item)}</span>
            </span>
            <span className="mt-1 block space-y-0.5">{series.map((entry, index) => bar(item, index, entry))}</span>
          </Row>
        )
      })}
    </div>
  )
}

export interface StackedShareSegment {
  key: string
  value: number
  color: string
  /** Tooltip for the segment. */
  title?: string
}

export type StackedShareBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  segments: readonly StackedShareSegment[]
  /** The value the full bar stands for. Defaults to 100, for percentages. */
  total?: number
}

/** One bar split into coloured segments, e.g. a recorded species mixture. */
export function StackedShareBar({ segments, total = 100, className, ...props }: StackedShareBarProps) {
  return (
    <div className={cn('flex h-3 overflow-hidden rounded bg-muted', className)} {...props}>
      {segments.map((segment) => (
        <div
          key={segment.key}
          title={segment.title}
          style={{
            width: `${total > 0 ? Math.max(0, (segment.value / total) * 100) : 0}%`,
            backgroundColor: segment.color,
          }}
        />
      ))}
    </div>
  )
}
