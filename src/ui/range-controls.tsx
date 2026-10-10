import type { InputHTMLAttributes } from 'react'
import { Button } from './button.js'

export interface RangeField {
  label: string
  value: string
  min?: string | number
  max?: string | number
  type?: 'date' | 'number' | 'time' | 'datetime-local'
  step?: InputHTMLAttributes<HTMLInputElement>['step']
}
export interface RangePreset {
  id: string
  label: string
  accessibleLabel?: string
  title?: string
}

/** Input representation and preset calculations belong to the host; this control has no calendar/domain policy. */
export function RangeControls({
  start,
  end,
  disabled,
  onChange,
  presets = [],
  onPreset,
  reset,
  label = 'Range controls',
  presetLabel = 'Range presets',
  testId,
}: {
  start: RangeField
  end: RangeField
  disabled?: boolean
  onChange: (field: 'start' | 'end', value: string) => void
  presets?: readonly RangePreset[]
  onPreset?: (id: string) => void
  reset?: { label: string; accessibleLabel?: string; disabled?: boolean; onClick: () => void }
  label?: string
  presetLabel?: string
  testId?: string
}) {
  const field = (name: 'start' | 'end', config: RangeField) => (
    <input
      aria-label={config.label}
      className="h-8 w-[134px] min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground"
      type={config.type ?? 'number'}
      value={config.value}
      min={config.min}
      max={config.max}
      step={config.step}
      disabled={disabled}
      onChange={(event) => onChange(name, event.target.value)}
    />
  )
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={label} data-testid={testId}>
      {field('start', start)}
      <span aria-hidden="true" className="px-1 text-xs text-muted-foreground">
        –
      </span>
      {field('end', end)}
      <div className="flex shrink-0 gap-1" aria-label={presetLabel}>
        {presets.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            aria-label={preset.accessibleLabel}
            title={preset.title}
            onClick={() => onPreset?.(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {reset && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2"
          disabled={disabled || reset.disabled}
          aria-label={reset.accessibleLabel}
          title={reset.accessibleLabel}
          onClick={reset.onClick}
        >
          {reset.label}
        </Button>
      )}
    </div>
  )
}
