import { Pipette } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { findCusp, gammaEncode, hexToOkhsv, okhsvToHex, okhsvToLinearSrgb, type Okhsv } from '../scales/okhsv.js'
import { cn } from '../utils.js'
import { useEyeDropper } from './use-eye-dropper.js'
import { usePointerDrag } from './use-pointer-drag.js'

/**
 * The `#rrggbb` form of a hex colour (`#abc` expands, case folds to lower), or `null` for anything
 * else: a name, `rgb()`, an alpha channel. Opacity is its own value everywhere in the toolkit.
 */
export function normalizeHexColor(value: string | null | undefined): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value?.trim() ?? '')
  if (!match) return null
  const hex = match[1].toLowerCase()
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`
}

/** The plane is drawn this small and scaled up smoothly: one hue's plane is a smooth surface. */
const PLANE_COLUMNS = 64
const PLANE_ROWS = 40
const HUE_STOPS = 24
const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const to255 = (linear: number) => Math.round(255 * clamp01(gammaEncode(linear)))

let hueRail: string | undefined
/** Every hue at full saturation and value, as the hue rail's background. */
function hueRailBackground(): string {
  hueRail ??= `linear-gradient(to right, ${Array.from({ length: HUE_STOPS + 1 }, (_, index) =>
    okhsvToHex({ h: (360 * index) / HUE_STOPS, s: 100, v: 100 }),
  ).join(', ')})`
  return hueRail
}

const CHECKERBOARD = 'repeating-conic-gradient(rgba(128,128,128,0.4) 0% 25%, transparent 0% 50%) 0 0 / 8px 8px'
const THUMB =
  'pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25),0_1px_3px_rgba(0,0,0,0.3)]'
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'

/** One hue's saturation and value plane, drawn in Okhsv. */
function drawPlane(canvas: HTMLCanvasElement, hue: number) {
  const context = canvas.getContext('2d')
  if (!context) return
  const image = context.createImageData(PLANE_COLUMNS, PLANE_ROWS)
  const turn = hue / 360
  const cusp = findCusp(Math.cos(2 * Math.PI * turn), Math.sin(2 * Math.PI * turn))
  for (let row = 0; row < PLANE_ROWS; row++) {
    const value = 1 - row / (PLANE_ROWS - 1)
    for (let column = 0; column < PLANE_COLUMNS; column++) {
      const [red, green, blue] = okhsvToLinearSrgb(turn, column / (PLANE_COLUMNS - 1), value, cusp)
      const at = 4 * (row * PLANE_COLUMNS + column)
      image.data[at] = to255(red)
      image.data[at + 1] = to255(green)
      image.data[at + 2] = to255(blue)
      image.data[at + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
}

interface Draft {
  hsv: Okhsv
  hex: string
}

/** A grey has no hue of its own, so it keeps the hue the person was on. */
function draftFromHex(hex: string, previous?: Okhsv): Draft {
  const hsv = hexToOkhsv(hex)
  return { hex, hsv: previous && (hsv.s < 0.5 || hsv.v < 0.5) ? { ...hsv, h: previous.h } : hsv }
}

export interface ColorPickerPanelProps {
  /** The colour in use, or `null` for none chosen. */
  value: string | null
  /** The colour the panel opens on while none is chosen (default white). */
  fallback?: string
  /** A settled colour, lower-case `#rrggbb`: the end of a drag, a key let go, a typed hex, a swatch. */
  onCommit: (hex: string) => void
  /** Every colour passed through during a drag, for a live preview. Never the place to save. */
  onPreview?: (hex: string) => void
  /** Names the controls, e.g. "Colour for Block 12". */
  label: string
  /** Suggested colours, shown as swatches under the hex box. */
  presets?: readonly string[]
  /** Colours already used nearby, shown as a second row of swatches. */
  recent?: readonly string[]
  /** Opacity 0–1. With `onOpacityCommit`, the panel adds an opacity rail. */
  opacity?: number
  onOpacityCommit?: (opacity: number) => void
  onOpacityPreview?: (opacity: number) => void
  /** Offer picking from the screen where the browser can (default true). */
  eyeDropper?: boolean
  className?: string
}

/**
 * The colour picker's controls, without a popover: a saturation and value plane and a hue rail in
 * Okhsv, an optional opacity rail, a hex box, a pick-from-screen button and swatches. A drag
 * previews; the colour is committed once, when the drag ends. `ColorField` opens it from a swatch.
 */
export function ColorPickerPanel({
  value,
  fallback = '#ffffff',
  onCommit,
  onPreview,
  label,
  presets,
  recent,
  opacity,
  onOpacityCommit,
  onOpacityPreview,
  eyeDropper = true,
  className,
}: ColorPickerPanelProps) {
  const committed = normalizeHexColor(value)
  const incoming = committed ?? normalizeHexColor(fallback) ?? '#ffffff'
  const [state, setState] = useState(() => ({ ...draftFromHex(incoming), source: incoming }))
  // Adopt a colour set from outside. Our own commit comes back as the same hex and keeps its hue.
  if (incoming !== state.source) {
    setState({ ...(incoming === state.hex ? state : draftFromHex(incoming, state.hsv)), source: incoming })
  }
  const [text, setText] = useState<string | null>(null)
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null)

  const draft = useRef<Draft>(state)
  const lastCommitted = useRef(committed)
  const opacityRef = useRef(opacity ?? 1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    draft.current = { hsv: state.hsv, hex: state.hex }
  }, [state.hsv, state.hex])
  useEffect(() => {
    lastCommitted.current = committed
  }, [committed])
  useEffect(() => {
    opacityRef.current = opacity ?? 1
  }, [opacity])

  const hue = Math.round(state.hsv.h * 2) / 2
  useEffect(() => {
    if (canvasRef.current) drawPlane(canvasRef.current, hue)
  }, [hue])

  const show = useCallback(
    (next: Draft) => {
      draft.current = next
      setState((previous) => ({ ...previous, ...next }))
      onPreview?.(next.hex)
    },
    [onPreview],
  )
  const change = useCallback((hsv: Okhsv) => show({ hsv, hex: okhsvToHex(hsv) }), [show])
  const commit = useCallback(() => {
    const { hex } = draft.current
    if (hex === lastCommitted.current) return
    lastCommitted.current = hex
    onCommit(hex)
  }, [onCommit])
  const choose = useCallback(
    (hex: string) => {
      show(draftFromHex(hex, draft.current.hsv))
      commit()
    },
    [show, commit],
  )

  const [planeRef, planeDragging, planeHandlers] = usePointerDrag<HTMLDivElement>(
    (x, y) => change({ ...draft.current.hsv, s: 100 * x, v: 100 * (1 - y) }),
    commit,
  )

  const moveOpacity = useCallback(
    (next: number) => {
      opacityRef.current = next
      setOpacityDraft(next)
      onOpacityPreview?.(next)
    },
    [onOpacityPreview],
  )
  const commitOpacity = useCallback(() => {
    const next = Math.round(opacityRef.current * 100) / 100
    setOpacityDraft(null)
    if (next !== opacity) onOpacityCommit?.(next)
  }, [onOpacityCommit, opacity])

  const pickFromScreen = useEyeDropper(
    useCallback(
      (picked: string) => {
        const hex = normalizeHexColor(picked)
        if (hex) choose(hex)
      },
      [choose],
    ),
  )

  const applyText = () => {
    const parsed = normalizeHexColor(text)
    setText(null)
    if (parsed && parsed !== draft.current.hex) choose(parsed)
  }
  const onPlaneKey = (event: KeyboardEvent) => {
    const arrow = ARROWS[event.key]
    if (!arrow) return
    event.preventDefault()
    const step = event.shiftKey ? 10 : 2
    const { hsv } = draft.current
    change({
      ...hsv,
      s: 100 * clamp01((hsv.s + arrow[0] * step) / 100),
      v: 100 * clamp01((hsv.v + arrow[1] * step) / 100),
    })
  }
  const shownOpacity = opacityDraft ?? opacity ?? 1
  const swatchRows = [
    { title: 'Presets', colors: presets },
    { title: 'Recent', colors: recent },
  ].flatMap(({ title, colors }) => {
    const valid = [...new Set((colors ?? []).map(normalizeHexColor).filter((color): color is string => !!color))]
    return valid.length ? [{ title, colors: valid }] : []
  })

  return (
    <div className={cn('grid gap-2', className)} data-color-picker="">
      <div
        ref={planeRef}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: saturation and brightness`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(state.hsv.s)}
        aria-valuetext={`Saturation ${Math.round(state.hsv.s)}%, brightness ${Math.round(state.hsv.v)}%`}
        onKeyDown={onPlaneKey}
        onKeyUp={(event) => ARROWS[event.key] && commit()}
        {...planeHandlers}
        className={cn('relative h-32 cursor-crosshair touch-none rounded-md', FOCUS)}
        // Shown until the canvas has drawn, and where there is no canvas at all.
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${okhsvToHex({ h: hue, s: 100, v: 100 })})`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={PLANE_COLUMNS}
          height={PLANE_ROWS}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full rounded-md"
        />
        <span className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-foreground/10" />
        <span
          className={cn(THUMB, planeDragging && 'scale-125')}
          style={{ left: `${state.hsv.s}%`, top: `${100 - state.hsv.v}%`, backgroundColor: state.hex }}
        />
      </div>

      <Rail
        label={`${label}: hue`}
        fraction={state.hsv.h / 360}
        valueNow={Math.round(state.hsv.h)}
        valueMax={360}
        valueText={`${Math.round(state.hsv.h)}°`}
        thumbColor={okhsvToHex({ h: state.hsv.h, s: 100, v: 100 })}
        background={hueRailBackground()}
        keyStep={1 / 180}
        onMove={(fraction) => change({ ...draft.current.hsv, h: Math.min(359.99, 360 * fraction) })}
        onEnd={commit}
      />
      {onOpacityCommit && (
        <Rail
          label={`${label}: opacity`}
          fraction={shownOpacity}
          valueNow={Math.round(shownOpacity * 100)}
          valueMax={100}
          valueText={`${Math.round(shownOpacity * 100)}%`}
          thumbColor={state.hex}
          background={`linear-gradient(to right, transparent, ${state.hex}), ${CHECKERBOARD}`}
          keyStep={0.02}
          onMove={moveOpacity}
          onEnd={commitOpacity}
        />
      )}

      <div className="flex items-center gap-1.5">
        <span
          className="size-7 shrink-0 rounded-md border border-border"
          style={{ backgroundColor: state.hex }}
          aria-hidden="true"
        />
        <input
          type="text"
          value={text ?? state.hex}
          onChange={(event) => setText(event.target.value)}
          onBlur={applyText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              applyText()
            }
          }}
          aria-label={`${label}: hex`}
          aria-invalid={text !== null && !normalizeHexColor(text) ? true : undefined}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          className={cn(
            'h-7 w-full min-w-0 rounded-md border border-input bg-background px-2 font-mono text-xs tabular-nums text-foreground',
            FOCUS,
          )}
        />
        {onOpacityCommit && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(shownOpacity * 100)}%
          </span>
        )}
        {eyeDropper && pickFromScreen && (
          <button
            type="button"
            aria-label="Pick a colour from the screen"
            title="Pick a colour from the screen"
            onClick={pickFromScreen}
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground',
              FOCUS,
            )}
          >
            <Pipette className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {swatchRows.map(({ title, colors }) => (
        <SwatchRow key={title} title={title} label={label} colors={colors} current={state.hex} onChoose={choose} />
      ))}
    </div>
  )
}

function SwatchRow({
  title,
  label,
  colors,
  current,
  onChoose,
}: {
  title: string
  label: string
  colors: readonly string[]
  current: string
  onChoose: (hex: string) => void
}) {
  return (
    <div className="grid gap-1" role="group" aria-label={`${label}: ${title.toLowerCase()}`}>
      <span className="text-2xs font-medium text-muted-foreground">{title}</span>
      <div className="grid grid-cols-8 gap-1">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${title}: ${color}`}
            aria-pressed={current === color}
            title={color}
            onClick={() => onChoose(color)}
            className={cn(
              'aspect-square w-full rounded-sm border border-border',
              FOCUS,
              current === color && 'ring-2 ring-ring ring-offset-1 ring-offset-popover',
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}

function Rail({
  label,
  fraction,
  valueNow,
  valueMax,
  valueText,
  thumbColor,
  background,
  keyStep,
  onMove,
  onEnd,
}: {
  label: string
  fraction: number
  valueNow: number
  valueMax: number
  valueText: string
  thumbColor: string
  background: string
  /** One arrow key press, as a fraction of the rail; Shift is five. */
  keyStep: number
  onMove: (fraction: number) => void
  onEnd: () => void
}) {
  const current = useRef(fraction)
  useEffect(() => {
    current.current = fraction
  }, [fraction])
  const move = (next: number) => {
    current.current = clamp01(next)
    onMove(current.current)
  }
  const [ref, , handlers] = usePointerDrag<HTMLDivElement>(move, onEnd)
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={valueMax}
      aria-valuenow={valueNow}
      aria-valuetext={valueText}
      onKeyDown={(event) => {
        const arrow = ARROWS[event.key]
        if (!arrow) return
        event.preventDefault()
        move(current.current + (arrow[0] + arrow[1]) * keyStep * (event.shiftKey ? 5 : 1))
      }}
      onKeyUp={(event) => ARROWS[event.key] && onEnd()}
      {...handlers}
      className={cn('relative mx-1.5 h-3 cursor-pointer touch-none rounded-full', FOCUS)}
      style={{ background }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-foreground/10" />
      <span className={cn(THUMB, 'top-1/2')} style={{ left: `${fraction * 100}%`, backgroundColor: thumbColor }} />
    </div>
  )
}
