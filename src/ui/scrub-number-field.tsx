import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

import { cn } from '../utils.js'
import { parseScrubInput, scrubDragValue, scrubFraction, snapScrubValue } from './scrub-number.js'

export interface ScrubNumberFieldProps {
  value: number
  /** Fires on every drag frame, key step and typed commit. */
  onChange: (value: number) => void
  /** Fires once when a drag ends or typed text is committed, for expensive work. */
  onCommit?: (value: number) => void
  min?: number
  max?: number
  /** Quantum for every value (default 1). */
  step?: number
  /** Accessible name, e.g. "RH threshold". */
  label: string
  /** Short unit badge on the right, e.g. "%" or "mm". */
  unit?: ReactNode
  /** Display text for the value; the typed text starts from `String(value)`. */
  format?: (value: number) => string
  /** px per step while dragging when a bound is open (default 4). */
  pixelsPerStep?: number
  disabled?: boolean
  className?: string
  /** Host theming: --gt-scrub-accent, --gt-scrub-bg, --gt-scrub-border, --gt-scrub-text, --gt-scrub-h, … */
  style?: CSSProperties
  id?: string
}

const DRAG_THRESHOLD = 3

/**
 * A compact numeric field: drag sideways to scrub, click to type, or use the
 * arrow keys (Shift for ×10, or ×0.1 while dragging). The tinted bar shows
 * where the value sits between `min` and `max`. Styling is plain CSS with
 * custom properties, so it works inside or outside a toolkit workspace.
 */
export function ScrubNumberField({
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  label,
  unit,
  format,
  pixelsPerStep,
  disabled = false,
  className,
  style,
  id,
}: ScrubNumberFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ x: number; start: number; moved: boolean; pointer: number } | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  // Enter unmounts the input, whose blur would otherwise commit a second time
  const editing = useRef(false)
  const bounds = { min, max, step }
  const shown = format ? format(value) : String(value)
  const fraction = scrubFraction(value, bounds)

  useEffect(() => {
    if (draft === null) return
    inputRef.current?.focus()
    inputRef.current?.select()
    // select once on entering edit mode, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft === null])

  const emit = (next: number, commit: boolean) => {
    const snapped = snapScrubValue(next, bounds)
    if (snapped !== value) onChange(snapped)
    if (commit) onCommit?.(snapped)
  }

  const startEditing = (initial?: string) => {
    if (disabled) return
    editing.current = true
    setDraft(initial ?? String(value))
  }
  const finishEditing = (commit: boolean) => {
    if (draft === null || !editing.current) return
    editing.current = false
    const typed = commit ? parseScrubInput(draft) : null
    setDraft(null)
    if (typed !== null) emit(typed, true)
    rootRef.current?.focus()
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || draft !== null || event.button !== 0) return
    event.preventDefault()
    rootRef.current?.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, start: value, moved: false, pointer: event.pointerId }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointer !== event.pointerId) return
    const dx = event.clientX - state.x
    if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD) return
    if (!state.moved) {
      state.moved = true
      setScrubbing(true)
    }
    const width = rootRef.current?.getBoundingClientRect().width ?? 0
    emit(
      scrubDragValue(state.start, dx, { ...bounds, width, pixelsPerStep, precision: event.shiftKey ? 0.1 : 1 }),
      false,
    )
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointer !== event.pointerId) return
    drag.current = null
    setScrubbing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (state.moved) onCommit?.(value)
    else startEditing()
  }
  const onPointerCancel = () => {
    drag.current = null
    setScrubbing(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || draft !== null) return
    const big = event.shiftKey ? 10 : 1
    const by = (n: number) => {
      event.preventDefault()
      emit(value + n * step, true)
    }
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        return by(big)
      case 'ArrowDown':
      case 'ArrowLeft':
        return by(-big)
      case 'PageUp':
        return by(10)
      case 'PageDown':
        return by(-10)
      case 'Home':
        if (min !== undefined) {
          event.preventDefault()
          emit(min, true)
        }
        return
      case 'End':
        if (max !== undefined) {
          event.preventDefault()
          emit(max, true)
        }
        return
      case 'Enter':
      case 'F2':
        event.preventDefault()
        return startEditing()
      default:
        if (/^[\d.,+-]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          startEditing(event.key)
        }
    }
  }

  return (
    <div
      ref={rootRef}
      id={id}
      className={cn('gt-scrub-field', className)}
      style={style}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={typeof unit === 'string' ? `${shown} ${unit}` : shown}
      aria-disabled={disabled || undefined}
      data-scrubbing={scrubbing || undefined}
      data-editing={draft !== null || undefined}
      title={disabled ? undefined : 'Drag to change · click to type'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      {fraction !== null && (
        <span className="gt-scrub-fill" style={{ width: `${fraction * 100}%` }} aria-hidden="true" />
      )}
      {draft === null ? (
        <span className="gt-scrub-value" aria-hidden="true">
          {shown}
        </span>
      ) : (
        <input
          ref={inputRef}
          className="gt-scrub-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={`${label} value`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finishEditing(true)}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') finishEditing(true)
            else if (event.key === 'Escape') finishEditing(false)
            else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              const base = parseScrubInput(draft) ?? value
              const next = snapScrubValue(
                base + (event.key === 'ArrowUp' ? 1 : -1) * step * (event.shiftKey ? 10 : 1),
                bounds,
              )
              setDraft(String(next))
              if (next !== value) onChange(next)
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
        />
      )}
      {unit !== undefined && unit !== null && unit !== '' && (
        <span className="gt-scrub-unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </div>
  )
}
