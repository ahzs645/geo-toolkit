import { useEffect, useRef, type ReactNode } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Button } from './button.js'
import { cn } from '../utils.js'

export interface PlaybackControlsProps {
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

/**
 * Step through an ordered series of frames — a time-lapse, a model run, a
 * story sequence — with play/pause, previous/next and a scrubber. The host owns
 * the frame and what it shows; this control only advances it.
 */
export function PlaybackControls({
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
}: PlaybackControlsProps) {
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
