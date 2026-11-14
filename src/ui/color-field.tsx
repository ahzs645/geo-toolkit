import { X } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../utils.js'
import { ColorPickerPanel, normalizeHexColor } from './color-picker.js'
import { Popover, PopoverContent, PopoverTrigger } from './popover.js'
import { rememberColor, useRecentColors } from './recent-colors.js'

export { normalizeHexColor } from './color-picker.js'

/** Unset reads as "default", not as a colour: light stripes behind a dashed border. */
export const COLOR_FIELD_UNSET_STYLE: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(45deg, #e5e7eb 0 2px, #ffffff 2px 4px)',
  borderStyle: 'dashed',
}

export interface ColorFieldProps {
  /** The chosen colour, or `null` for none chosen (the host's default applies). */
  value: string | null
  /**
   * A settled colour (lower-case `#rrggbb`): the end of a drag in the picker, a typed hex, a
   * swatch, or `null` from the reset button. A drag reports once, so this is the place to save.
   */
  onChange: (value: string | null) => void
  /** Every colour a drag passes through, for a live preview on a map. Optional; never the place to save. */
  onPreview?: (value: string) => void
  /** Accessible name of the colour button, e.g. "Colour for Block 12". */
  label: string
  /** Suggested colours: a row of swatches beside the field and in the picker. */
  presets?: readonly string[]
  /** `'picker'` keeps presets inside the picker only, for a field in a dense row (default `'row'`). */
  presetDisplay?: 'row' | 'picker'
  /** Accessible name of the reset button (default "Reset {label}"). */
  resetLabel?: string
  /** `false` leaves out the reset button, for a colour that cannot be unset (default true). */
  resettable?: boolean
  /** Tooltip while a colour is set (default: `label`). */
  title?: string
  /** Tooltip while none is set (default "Default colour: choose one"). */
  unsetTitle?: string
  /** The colour the picker opens on while none is set (default white). */
  pickerFallback?: string
  /** Opacity 0–1, kept as its own value. With `onOpacityChange` the picker adds an opacity rail. */
  opacity?: number
  onOpacityChange?: (opacity: number) => void
  onOpacityPreview?: (opacity: number) => void
  /** Offer the colours picked on this page as a second row of swatches (default true). */
  recents?: boolean
  /** Offer picking from the screen where the browser can (default true). */
  eyeDropper?: boolean
  /** Drawn inside the button in place of the plain colour, e.g. a map symbol in that colour. */
  swatch?: ReactNode
  /** Classes for the swatch button, for a host whose swatches have their own shape (`rounded-full`). */
  swatchClassName?: string
  /** Which side of the swatch the picker prefers; it still flips to stay on screen (default `'bottom'`). */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** `'sm'` is a 14 px swatch for a list row; `'md'` a 24 px one for a form (default). */
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

const swatchSize = { sm: 'h-3.5 w-3.5', md: 'h-6 w-6' } as const
const presetSize = { sm: 'h-3 w-3', md: 'h-5 w-5' } as const

/**
 * Pick a colour or leave it unset. The swatch opens the colour picker (a saturation and value
 * plane, a hue rail, a hex box, pick-from-screen and swatches); presets set a colour in one
 * click; while a colour is set, a reset button returns it to `null`. Unset is drawn striped with
 * a dashed border, so it never reads as white. Dragging in the picker previews, and `onChange`
 * reports once when the drag ends.
 */
export function ColorField({
  value,
  onChange,
  onPreview,
  label,
  presets,
  presetDisplay = 'row',
  resetLabel,
  resettable = true,
  title,
  unsetTitle = 'Default colour: choose one',
  pickerFallback = '#ffffff',
  opacity,
  onOpacityChange,
  onOpacityPreview,
  recents = true,
  eyeDropper = true,
  swatch,
  swatchClassName,
  side = 'bottom',
  size = 'md',
  disabled = false,
  className,
}: ColorFieldProps) {
  const [open, setOpen] = useState(false)
  /** The colour under the pointer during a drag; the button shows it before it is committed. */
  const [preview, setPreview] = useState<string | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  const recent = useRecentColors()
  const swatches = (presets ?? []).map(normalizeHexColor).filter((color): color is string => color !== null)
  const current = normalizeHexColor(value)
  const shown = preview ?? value

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    setPreview(null)
    if (next) setOpened(current)
    // The colour the person settled on joins the page's recent colours when the picker closes.
    else if (current && current !== opened) rememberColor(current)
  }

  return (
    <span
      className={cn('inline-flex shrink-0 items-center', size === 'sm' ? 'gap-0.5' : 'gap-1.5', className)}
      data-color-field=""
      data-unset={value === null || undefined}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            title={value === null ? unsetTitle : (title ?? label)}
            disabled={disabled}
            data-color-value={current ?? undefined}
            className={cn(
              'relative block shrink-0 overflow-hidden rounded-sm border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
              !swatch && swatchSize[size],
              swatchClassName,
            )}
            style={swatch ? undefined : shown === null ? COLOR_FIELD_UNSET_STYLE : { backgroundColor: shown }}
          >
            {swatch}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2.5" side={side} aria-label={label}>
          <ColorPickerPanel
            value={value}
            fallback={pickerFallback}
            label={label}
            presets={swatches}
            recent={recents ? recent : undefined}
            opacity={opacity}
            onOpacityCommit={onOpacityChange}
            onOpacityPreview={onOpacityPreview}
            eyeDropper={eyeDropper}
            onPreview={(hex) => {
              setPreview(hex)
              onPreview?.(hex)
            }}
            onCommit={(hex) => {
              setPreview(null)
              onChange(hex)
            }}
          />
        </PopoverContent>
      </Popover>
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
              onClick={() => {
                onChange(color)
                rememberColor(color)
              }}
            />
          ))}
        </span>
      )}
      {resettable && value !== null && (
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
