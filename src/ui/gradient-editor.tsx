import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { CUSTOM_RAMP_LIMITS, cleanRampOffsets, customRampColorAt, customRampCss } from '../scales/customRamps.js'
import { cn } from '../utils.js'
import { ColorPickerPanel } from './color-picker.js'

/** Pixels a stop is dragged away from the bar before letting go removes it. */
const REMOVE_DISTANCE_PX = 34

const evenly = (count: number) => Array.from({ length: count }, (_, index) => (count === 1 ? 0 : index / (count - 1)))
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

export interface GradientStopsEditorProps {
  /** The ramp's colours, low to high. */
  stops: readonly string[]
  /** Where each sits, 0 to 1. Absent: evenly spaced. */
  at?: readonly number[]
  /** The stops in order, with their positions, or `undefined` positions when they are evenly spaced. */
  onChange: (stops: string[], at: number[] | undefined) => void
  /** Names the controls, e.g. "Gradient". */
  label: string
  className?: string
}

/**
 * A gradient's stops on a bar: click the bar to add a stop, drag a stop to move it, drag it away
 * from the bar or press Delete to remove it, and pick the selected stop's colour below. Arrow keys
 * nudge the selected stop (Shift for a bigger step). A ramp keeps at least two stops.
 */
export function GradientStopsEditor({ stops, at, onChange, label, className }: GradientStopsEditorProps) {
  const bar = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; index: number } | null>(null)
  const [selected, setSelected] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const positions = at ?? evenly(stops.length)
  const active = Math.min(selected, stops.length - 1)
  const { minStops, maxStops } = CUSTOM_RAMP_LIMITS

  /** Hand back the stops sorted by position, keeping the selection on the stop that was moved. */
  const emit = (nextStops: readonly string[], nextAt: readonly number[], keep: number) => {
    const order = nextStops.map((_, index) => index).sort((a, b) => nextAt[a] - nextAt[b] || a - b)
    const sortedAt = order.map((index) => nextAt[index])
    setSelected(Math.max(0, order.indexOf(keep)))
    onChange(
      order.map((index) => nextStops[index]),
      cleanRampOffsets(sortedAt, order.length),
    )
    return order.indexOf(keep)
  }
  const fractionAt = (clientX: number) => {
    const box = bar.current?.getBoundingClientRect()
    return box && box.width > 0 ? clamp01((clientX - box.left) / box.width) : 0
  }
  const remove = (index: number) => {
    if (stops.length <= minStops) return
    const nextStops = stops.filter((_, i) => i !== index)
    const nextAt = positions.filter((_, i) => i !== index)
    setSelected(Math.min(index, nextStops.length - 1))
    onChange(nextStops, cleanRampOffsets(nextAt, nextStops.length))
  }
  const move = (index: number, to: number) =>
    emit(
      stops,
      positions.map((position, i) => (i === index ? clamp01(to) : position)),
      index,
    )

  const onBarPointerDown = (event: PointerEvent) => {
    if (event.target !== event.currentTarget || stops.length >= maxStops) return
    event.preventDefault()
    const t = fractionAt(event.clientX)
    emit([...stops, customRampColorAt(stops, positions, t)], [...positions, t], stops.length)
  }
  const onStopPointerDown = (event: PointerEvent, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
    drag.current = { pointer: event.pointerId, index }
    setSelected(index)
  }
  const onStopPointerMove = (event: PointerEvent) => {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    const box = bar.current?.getBoundingClientRect()
    const away = box ? Math.abs(event.clientY - (box.top + box.height / 2)) > REMOVE_DISTANCE_PX : false
    setLeaving(away && stops.length > minStops)
    current.index = move(current.index, fractionAt(event.clientX))
  }
  const onStopPointerUp = (event: PointerEvent) => {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    drag.current = null
    if (leaving) remove(current.index)
    setLeaving(false)
  }
  const onStopKey = (event: KeyboardEvent, index: number) => {
    const step = event.shiftKey ? 0.05 : 0.01
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      move(index, positions[index] + (event.key === 'ArrowLeft' ? -step : step))
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      remove(index)
    }
  }
  const setColor = (hex: string) =>
    onChange(
      stops.map((stop, index) => (index === active ? hex : stop)),
      at ? [...at] : undefined,
    )

  return (
    <div className={cn('grid gap-2', className)} data-gradient-editor="">
      <div className="px-2 pb-3 pt-1">
        <div
          ref={bar}
          role="group"
          aria-label={`${label}: stops. Click the bar to add one.`}
          title={stops.length < maxStops ? 'Click to add a colour' : undefined}
          onPointerDown={onBarPointerDown}
          className={cn(
            'relative h-6 touch-none rounded-sm border border-border',
            stops.length < maxStops && 'cursor-copy',
          )}
          style={{ background: customRampCss(stops, positions) }}
        >
          {stops.map((stop, index) => (
            <button
              key={index}
              type="button"
              aria-label={`${label}: colour ${index + 1} of ${stops.length}, ${stop}, at ${Math.round(positions[index] * 100)}%`}
              aria-pressed={index === active}
              data-gradient-stop={index}
              onPointerDown={(event) => onStopPointerDown(event, index)}
              onPointerMove={onStopPointerMove}
              onPointerUp={onStopPointerUp}
              onPointerCancel={onStopPointerUp}
              onKeyDown={(event) => onStopKey(event, index)}
              onFocus={() => setSelected(index)}
              className={cn(
                'absolute top-full h-4 w-3 -translate-x-1/2 -translate-y-1 cursor-grab touch-none rounded-sm border-2 border-background shadow-[0_0_0_1px_rgba(0,0,0,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
                index === active && 'z-10 ring-2 ring-ring',
                index === active && leaving && 'opacity-30',
              )}
              style={{ left: `${positions[index] * 100}%`, backgroundColor: stop }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
        <span>
          Colour {active + 1} of {stops.length}
        </span>
        <button
          type="button"
          className="rounded-sm underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline"
          disabled={stops.length <= minStops}
          onClick={() => remove(active)}
        >
          Remove this colour
        </button>
      </div>
      <ColorPickerPanel
        key={active}
        value={stops[active]}
        label={`${label}: colour ${active + 1}`}
        onPreview={setColor}
        onCommit={setColor}
      />
    </div>
  )
}
