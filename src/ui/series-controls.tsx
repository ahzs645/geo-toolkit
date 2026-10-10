import { X } from 'lucide-react'
import { Button } from './button.js'

export interface SeriesControlItem {
  id: string
  label: string
  color: string
  visible: boolean
  detail?: string
}

/** Controlled visibility: hiding a line never removes the host's selection or changes its color. */
export function SeriesLegend({
  items,
  onToggle,
  compact = false,
  label = 'Series',
}: {
  items: readonly SeriesControlItem[]
  onToggle: (id: string) => void
  compact?: boolean
  label?: string
}) {
  return (
    <div className="flex flex-wrap gap-1" aria-label={label}>
      {items.map((item) => (
        <Button
          key={item.id}
          variant="ghost"
          size="sm"
          aria-label={`Show series ${item.label}`}
          aria-pressed={item.visible}
          onClick={() => onToggle(item.id)}
          title={item.label}
          className={`${compact ? 'size-7 p-0' : 'h-6'} ${item.visible ? '' : 'opacity-50 line-through'}`}
        >
          <span
            className={compact ? 'size-2.5 rounded-full' : 'mr-2 h-0.5 w-4'}
            style={{ backgroundColor: item.color }}
          />
          <span className={compact ? 'sr-only' : undefined}>{item.label}</span>
        </Button>
      ))}
    </div>
  )
}

export function SelectedSeriesList({
  items,
  onToggle,
  onRemove,
  empty = 'Choose a series.',
  testId,
}: {
  items: readonly SeriesControlItem[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  empty?: string
  testId?: string
}) {
  return (
    <div className="space-y-1" data-testid={testId}>
      {!items.length && <p className="text-xs text-muted-foreground">{empty}</p>}
      {items.map((item) => (
        <div key={item.id} className="flex min-w-0 items-center gap-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 min-w-0 flex-1 justify-start gap-2 px-1 ${item.visible ? '' : 'opacity-50'}`}
            aria-label={`Show series ${item.label}`}
            aria-pressed={item.visible}
            title={`${item.visible ? 'Hide' : 'Show'} ${item.label} on the graphs`}
            onClick={() => onToggle(item.id)}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className={`shrink-0 font-medium ${item.visible ? '' : 'line-through'}`}>{item.label}</span>
            <span className="truncate text-xs text-muted-foreground" title={item.detail}>
              {item.detail}
            </span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            aria-label={`Remove ${item.label}`}
            onClick={() => onRemove(item.id)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}
