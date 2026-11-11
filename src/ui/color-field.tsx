import { useId, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import { cn } from '../utils.js'

/**
 * The `#rrggbb` form of a hex colour (`#abc` expands, case folds to lower), or
 * `null` for anything a native colour input cannot hold — a name, `rgb()`, an
 * alpha channel.
 */
export function normalizeHexColor(value: string | null | undefined): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value?.trim() ?? '')
  if (!match) return null
  const hex = match[1].toLowerCase()
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`
}

/** Unset reads as "default", not as a colour: light stripes behind a dashed border. */
export const COLOR_FIELD_UNSET_STYLE: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(45deg, #e5e7eb 0 2px, #ffffff 2px 4px)',
  borderStyle: 'dashed',
}

export interface ColorFieldProps {
  /** The chosen colour, or `null` for none chosen (the host's default applies). */
  value: string | null
  /** A colour from the picker or a preset (lower-case `#rrggbb`), or `null` from the reset button. */
  onChange: (value: string | null) => void
  /** Accessible name of the colour input, e.g. "Colour for Block 12". */
  label: string
  /** Suggested colours: a row of swatches beside the field and the native picker's own list. */
  presets?: readonly string[]
  /** `'picker'` keeps presets in the native picker's list only, for a field inside a dense row (default `'row'`). */
  presetDisplay?: 'row' | 'picker'
  /** Accessible name of the reset button (default "Reset {label}"). */
  resetLabel?: string
  /** Tooltip while a colour is set (default: `label`). */
  title?: string
  /** Tooltip while none is set (default "Default colour: choose one"). */
  unsetTitle?: string
  /** The colour the native picker opens on while none is set (default white). */
  pickerFallback?: string
  /** `'sm'` is a 14 px swatch for a list row; `'md'` a 24 px one for a form (default). */
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

const swatchSize = { sm: 'h-3.5 w-3.5', md: 'h-6 w-6' } as const
const presetSize = { sm: 'h-3 w-3', md: 'h-5 w-5' } as const

/**
 * Pick a colour or leave it unset. The swatch opens the native colour input;
 * presets set a colour in one click; while a colour is set, a reset button
 * returns it to `null`. Unset is drawn striped with a dashed border, so it
 * never reads as white.
 */
export function ColorField({
  value,
  onChange,
  label,
  presets,
  presetDisplay = 'row',
  resetLabel,
  title,
  unsetTitle = 'Default colour: choose one',
  pickerFallback = '#ffffff',
  size = 'md',
  disabled = false,
  className,
}: ColorFieldProps) {
  const listId = useId()
  const swatches = (presets ?? []).map(normalizeHexColor).filter((color): color is string => color !== null)
  const current = normalizeHexColor(value)
  return (
    <span
      className={cn('inline-flex shrink-0 items-center', size === 'sm' ? 'gap-0.5' : 'gap-1.5', className)}
      data-color-field=""
      data-unset={value === null || undefined}
    >
      <label
        className={cn(
          'relative block shrink-0 overflow-hidden rounded-sm border border-border',
          swatchSize[size],
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
        style={value === null ? COLOR_FIELD_UNSET_STYLE : { backgroundColor: value }}
        title={value === null ? unsetTitle : (title ?? label)}
      >
        <input
          type="color"
          aria-label={label}
          list={swatches.length > 0 ? listId : undefined}
          className="absolute inset-0 h-full w-full cursor-[inherit] opacity-0"
          value={current ?? normalizeHexColor(pickerFallback) ?? '#ffffff'}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
        />
        {swatches.length > 0 && (
          <datalist id={listId}>
            {swatches.map((color) => (
              <option key={color} value={color} />
            ))}
          </datalist>
        )}
      </label>
      {presetDisplay === 'row' && swatches.length > 0 && (
        <span className="flex items-center gap-1" role="group" aria-label={`${label}: presets`}>
          {swatches.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                'shrink-0 rounded-sm border border-border disabled:cursor-not-allowed disabled:opacity-50',
                presetSize[size],
                current === color && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
              )}
              style={{ backgroundColor: color }}
              aria-label={`${label}: ${color}`}
              aria-pressed={current === color}
              title={color}
              disabled={disabled}
              onClick={() => onChange(color)}
            />
          ))}
        </span>
      )}
      {value !== null && (
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={resetLabel ?? `Reset ${label}`}
          title="Back to the default colour"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <X className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      )}
    </span>
  )
}
