import { ArrowLeftRight, Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { colorRampCss } from '../scales/colorRamps.js'
import { cn } from '../utils.js'
import { Popover, PopoverContent, PopoverTrigger } from './popover.js'

/** A ramp a `RampField` can offer: a stable id, a name and its colours low to high. */
export interface RampOption {
  id: string
  label: string
  colors: readonly string[]
  /** Ramps with the same group are listed under one heading, in the order groups first appear. */
  group?: string
}

export interface RampFieldProps {
  /** The chosen ramp's id. An id that is not offered shows as its own text, never as another ramp. */
  value: string
  onChange: (id: string) => void
  ramps: readonly RampOption[]
  /** Accessible name, e.g. "Colour ramp". */
  label: string
  /** Draw every ramp high to low. With `onReverseChange` the field adds a button that flips it. */
  reverse?: boolean
  onReverseChange?: (reverse: boolean) => void
  disabled?: boolean
  className?: string
}

/**
 * Pick a colour ramp from a list that shows each one as its gradient, with the chosen ramp's
 * gradient on the button too, so the colours are in view while choosing. An optional button
 * beside it reverses the ramp.
 */
export function RampField({
  value,
  onChange,
  ramps,
  label,
  reverse = false,
  onReverseChange,
  disabled,
  className,
}: RampFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = ramps.find((ramp) => ramp.id === value)
  const groups: { name: string | undefined; ramps: RampOption[] }[] = []
  for (const ramp of ramps) {
    const group = groups.find(({ name }) => name === ramp.group)
    if (group) group.ramps.push(ramp)
    else groups.push({ name: ramp.group, ramps: [ramp] })
  }
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)} data-ramp-field="">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${selected?.label ?? value}`}
            aria-haspopup="listbox"
            disabled={disabled}
            data-ramp-value={value}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-16 shrink-0 rounded-sm border border-border"
              style={{ background: selected ? colorRampCss(selected.colors, reverse) : undefined }}
            />
            <span className="min-w-0 flex-1 truncate">{selected?.label ?? value}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-h-72 w-64 overflow-y-auto p-1" aria-label={label}>
          <div role="listbox" aria-label={label}>
            {groups.map(({ name, ramps: members }) => (
              <div key={name ?? ''} role="group" aria-label={name}>
                {name && <div className="px-2 pb-0.5 pt-1.5 text-2xs font-medium text-muted-foreground">{name}</div>}
                {members.map((ramp) => (
                  <button
                    key={ramp.id}
                    type="button"
                    role="option"
                    aria-selected={ramp.id === value}
                    data-ramp-option={ramp.id}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent',
                      ramp.id === value && 'bg-accent',
                    )}
                    onClick={() => {
                      onChange(ramp.id)
                      setOpen(false)
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-20 shrink-0 rounded-sm border border-border"
                      style={{ background: colorRampCss(ramp.colors, reverse) }}
                    />
                    <span className="min-w-0 flex-1 truncate">{ramp.label}</span>
                    {ramp.id === value && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {onReverseChange && (
        <button
          type="button"
          aria-label={`${label}: reverse`}
          aria-pressed={reverse}
          title={reverse ? 'Reversed: high to low' : 'Reverse the ramp'}
          disabled={disabled}
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            reverse && 'border-primary text-foreground ring-1 ring-primary',
          )}
          onClick={() => onReverseChange(!reverse)}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
