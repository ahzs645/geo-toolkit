import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Button } from './button.js'
import { cn } from '../utils.js'

export interface FramePlaybackControlsProps {
  /** Steps whole frames on the control's own timer (the default mode). */
  mode?: 'frames'
  /** Current frame, 0-based. */
  frame: number
  frameCount: number
  onFrameChange: (frame: number) => void
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  /** Milliseconds per frame while playing (default: 400). */
  intervalMs?: number
  /** Start over after the last frame instead of stopping (default: true). */
  loop?: boolean
  /** What the current frame shows, e.g. its date. */
  frameLabel?: ReactNode
  /** Accessible name for the group (default: "Playback"). */
  label?: string
  disabled?: boolean
  className?: string
}

export interface ContinuousPlaybackControlsProps {
  /**
   * A continuous position — metres along a route, seconds into a recording —
   * that the host's own animation loop advances while `playing`. The control
   * runs no timer: it seeks, steps and asks to play or pause.
   */
  mode: 'continuous'
  value: number
  /** Start of the range (default 0). */
  min?: number
  max: number
  /** The scrubber's granularity, in the value's units (default 1). */
  step?: number
  /** Called on a scrub or a ± step, with a value inside `min`–`max`. */
  onValueChange: (value: number) => void
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  /**
   * Whether play may start now (default true), e.g. false while the host is
   * still loading what it plays. Pause stays available.
   */
  canPlay?: boolean
  /** How far the ‹ › buttons move, in the value's units. Omit to hide them. */
  skip?: number
  /** The skip as read aloud, e.g. "10 m": the buttons are "Back 10 m" and "Forward 10 m". */
  skipLabel?: string
  /** Formats a position for the label and the scrubber's spoken value (default: the number). */
  formatValue?: (value: number) => string
  /**
   * What sits after the scrubber (default "value / max", the "/ max" part
   * hidden on narrow workspaces).
   */
  valueLabel?: ReactNode
  /** The scrubber's spoken value (default "value of max"). */
  valueText?: string
  /** Accessible name of the scrubber (default "Position"). */
  seekLabel?: string
  /** Pause when the scrubber is dragged (default true). The ‹ › buttons always pause. */
  pauseOnScrub?: boolean
  /** `'labelled'` draws a primary Play/Pause button with its word; `'icon'` matches the frame mode (default). */
  playButton?: 'icon' | 'labelled'
  /** Extra controls at the end of the row — a speed picker, an exit button. */
  actions?: ReactNode
  /** Accessible name for the group (default: "Playback"). */
  label?: string
  disabled?: boolean
  className?: string
}

export type PlaybackControlsProps = FramePlaybackControlsProps | ContinuousPlaybackControlsProps

/**
 * Step through an ordered series of frames — a time-lapse, a model run, a
 * story sequence — with play/pause, previous/next and a scrubber. The host owns
 * the frame and what it shows; this control only advances it.
 *
 * With `mode="continuous"` it seeks a continuous position instead, and the
 * host's animation loop advances it.
 */
export function PlaybackControls(props: PlaybackControlsProps) {
  return props.mode === 'continuous' ? <ContinuousPlaybackControls {...props} /> : <FramePlaybackControls {...props} />
}

/** Clamp to `min`–`max`, treating a reversed or empty range as `min`. */
export function clampPlaybackValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(min, max), Math.max(min, value))
}

function ContinuousPlaybackControls({
  value,
  min = 0,
  max,
  step = 1,
  onValueChange,
  playing,
  onPlayingChange,
  canPlay = true,
  skip,
  skipLabel,
  formatValue = String,
  valueLabel,
  valueText,
  seekLabel = 'Position',
  pauseOnScrub = true,
  playButton = 'icon',
  actions,
  label = 'Playback',
  disabled = false,
  className,
}: ContinuousPlaybackControlsProps) {
  const end = Math.max(min, max)
  const shown = clampPlaybackValue(value, min, end)
  const inactive = disabled || end <= min
  const stepBy = (delta: number) => {
    onPlayingChange(false)
    onValueChange(clampPlaybackValue(shown + delta, min, end))
  }
  const skipName = skipLabel ?? (skip === undefined ? '' : formatValue(skip))
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} role="group" aria-label={label}>
      {playButton === 'labelled' ? (
        <Button
          size="sm"
          className="h-8 shrink-0 px-3 font-semibold touch:h-10"
          aria-pressed={playing}
          disabled={inactive || (!playing && !canPlay)}
          onClick={() => onPlayingChange(!playing)}
        >
          {playing ? <Pause /> : <Play />}
          {playing ? 'Pause' : 'Play'}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 touch:h-10 touch:w-10"
          aria-label={playing ? 'Pause' : 'Play'}
          aria-pressed={playing}
          disabled={inactive || (!playing && !canPlay)}
          onClick={() => onPlayingChange(!playing)}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
      )}
      {skip !== undefined && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Back ${skipName}`}
          title={`Back ${skipName}`}
          className="h-8 w-8 shrink-0 workspace-max-sm:hidden touch:h-10 touch:w-10"
          disabled={inactive || shown <= min}
          onClick={() => stepBy(-skip)}
        >
          <ChevronLeft />
        </Button>
      )}
      <input
        type="range"
        className="min-w-[6rem] flex-1 accent-[hsl(var(--primary))]"
        min={min}
        max={end}
        step={step}
        value={shown}
        disabled={inactive}
        aria-label={seekLabel}
        aria-valuetext={valueText ?? `${formatValue(shown)} of ${formatValue(end)}`}
        onChange={(event) => {
          if (pauseOnScrub) onPlayingChange(false)
          onValueChange(clampPlaybackValue(Number(event.target.value), min, end))
        }}
      />
      {skip !== undefined && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Forward ${skipName}`}
          title={`Forward ${skipName}`}
          className="h-8 w-8 shrink-0 workspace-max-sm:hidden touch:h-10 touch:w-10"
          disabled={inactive || shown >= end}
          onClick={() => stepBy(skip)}
        >
          <ChevronRight />
        </Button>
      )}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-live="off">
        {valueLabel ?? (
          <>
            {formatValue(shown)}
            <span className="workspace-max-sm:hidden"> / {formatValue(end)}</span>
          </>
        )}
      </span>
      {actions != null && actions !== false && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

function FramePlaybackControls({
  frame,
  frameCount,
  onFrameChange,
  playing,
  onPlayingChange,
  intervalMs = 400,
  loop = true,
  frameLabel,
  label = 'Playback',
  disabled = false,
  className,
}: FramePlaybackControlsProps) {
  const last = Math.max(0, frameCount - 1)
  const inactive = disabled || frameCount < 2
  const latest = useRef({ frame, last, loop, onFrameChange, onPlayingChange })
  useEffect(() => {
    latest.current = { frame, last, loop, onFrameChange, onPlayingChange }
  })

  useEffect(() => {
    if (!playing || inactive) return
    const timer = window.setInterval(() => {
      const {
        frame: current,
        last: end,
        loop: wrap,
        onFrameChange: change,
        onPlayingChange: setPlaying,
      } = latest.current
      if (current < end) change(current + 1)
      else if (wrap) change(0)
      else setPlaying(false)
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [inactive, intervalMs, playing])

  const step = (delta: number) => {
    onPlayingChange(false)
    const next = frame + delta
    onFrameChange(loop ? (next + frameCount) % frameCount : Math.min(last, Math.max(0, next)))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="group" aria-label={label}>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Previous frame"
          disabled={inactive}
          onClick={() => step(-1)}
        >
          <SkipBack />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label={playing ? 'Pause' : 'Play'}
          aria-pressed={playing}
          disabled={inactive}
          onClick={() => {
            // Playing from the end of a non-looping series starts it over.
            if (!playing && !loop && frame >= last) onFrameChange(0)
            onPlayingChange(!playing)
          }}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Next frame"
          disabled={inactive}
          onClick={() => step(1)}
        >
          <SkipForward />
        </Button>
      </div>
      <input
        type="range"
        className="min-w-[8rem] flex-1 accent-[hsl(var(--primary))]"
        min={0}
        max={last}
        step={1}
        value={Math.min(frame, last)}
        disabled={inactive}
        aria-label="Frame"
        aria-valuetext={typeof frameLabel === 'string' ? frameLabel : undefined}
        onChange={(event) => {
          onPlayingChange(false)
          onFrameChange(Number(event.target.value))
        }}
      />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-live="off">
        {frameLabel ?? `${Math.min(frame, last) + 1} / ${frameCount}`}
      </span>
    </div>
  )
}
