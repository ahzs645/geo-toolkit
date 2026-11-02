import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '../utils.js'
import {
  formatTimelineWindow,
  timelineMaxIndex,
  timelineWindow,
  type TimelineBucket,
  type TimelineGranularity,
  type TimelineWindowAnchor,
  type TimelineWindowSize,
} from '../calculations/timeline.js'
import { calculatePercentageChange, formatPercentChange } from '../calculations/timelineChange.js'
import { mapCornerTargets } from '../map/map-corners.js'
import { useIsMobile } from '../workspace/useIsMobile.js'
import { useMediaQuery } from '../workspace/useMediaQuery.js'
import { useWorkspaceInteractions } from '../workspace/workspace-context.js'
import { MOBILE_MAP_SHEET_COLLAPSE_EVENT } from '../workspace/workspace-events.js'
import { useVisibleMapPanel } from '../workspace/visible-map-panels.js'
import { MAP_OVERLAY_Z } from './map-overlay.js'

export interface MapTimelineWindowOption {
  value: TimelineWindowSize
  label: string
}

export interface MapTimelineWindow {
  size: TimelineWindowSize
  onSizeChange: (size: TimelineWindowSize) => void
  options: readonly MapTimelineWindowOption[]
  /** Where `value` sits in the window: its first bucket (default) or its last. */
  anchor?: TimelineWindowAnchor
}

export interface MapTimelineSpeed {
  intervalMs: number
  label: string
}

export type MapTimelineDensity = 'full' | 'compact' | 'mini'

export interface MapTimelineProps {
  buckets: readonly TimelineBucket[]
  /** Index of the bucket the window is anchored on. */
  value: number
  onValueChange: (index: number) => void
  /** Accessible name of the scrubber. */
  label?: string
  /** Shapes range labels ("Sep–Nov 2025"); optional for custom buckets. */
  granularity?: TimelineGranularity
  /** Per-bucket values keyed by `bucket.key`; drawn as a histogram on the track. */
  values?: ReadonlyMap<string, number>
  formatValue?: (value: number) => string
  /** Unit read out with a value, e.g. "inspections". */
  valueLabel?: string
  window?: MapTimelineWindow
  /** Read out the change against an earlier bucket, e.g. `{ label: 'YoY' }`. */
  change?: { label?: string; offset?: number }
  /** Page facts shown beside the date at every size, e.g. "1,204 visible". */
  summary?: ReactNode
  speeds?: readonly MapTimelineSpeed[]
  playing?: boolean
  onPlayingChange?: (playing: boolean) => void
  /** Start over from the first bucket instead of stopping at the end. */
  loop?: boolean
  onClose?: () => void
  /** 'auto' picks from the timeline's own width, not the viewport's. */
  density?: 'auto' | MapTimelineDensity
  /** 'map-overlay' floats over the map's bottom edge; 'inline' sits in normal flow. */
  placement?: 'map-overlay' | 'inline'
  /** Room per axis label before the axis thins out. */
  minLabelPx?: number
  className?: string
}

export const DEFAULT_TIMELINE_SPEEDS: readonly MapTimelineSpeed[] = [
  { intervalMs: 2000, label: '0.5x' },
  { intervalMs: 1000, label: '1x' },
  { intervalMs: 500, label: '2x' },
  { intervalMs: 250, label: '4x' },
]

const FULL_MIN_WIDTH = 880
// 44px touch targets need more room before everything fits on one row.
const FULL_MIN_WIDTH_TOUCH = 960
const COMPACT_MIN_WIDTH = 420
// Below this map height (a landscape phone) the track gives up height first.
const SHORT_MAP_HEIGHT = 480
const MIN_LABEL_PX: Record<TimelineGranularity, number> = { week: 64, month: 44, year: 40, decade: 52 }
// Round strides keep a thinned axis on calendar years (1990, 2000…).
const NICE_STRIDES = [1, 2, 5, 10, 20, 25, 50, 100]
const HOLD_DELAY_MS = 400
const HOLD_REPEAT_MS = 120

/** The density a timeline of this width gets with `density="auto"`. */
export function timelineDensityForWidth(width: number, touch = false): MapTimelineDensity {
  if (width >= (touch ? FULL_MIN_WIDTH_TOUCH : FULL_MIN_WIDTH)) return 'full'
  if (width >= COMPACT_MIN_WIDTH) return 'compact'
  return 'mini'
}

/** Which bucket indices carry an axis label at this track width. */
export function timelineTickIndices(
  buckets: readonly TimelineBucket[],
  trackWidth: number,
  minLabelPx: number,
  granularity?: TimelineGranularity,
): number[] {
  if (!buckets.length || trackWidth <= 0) return []
  const periodStarts = buckets.map((bucket, index) => (bucket.periodStart ? index : -1)).filter((i) => i >= 0)
  const candidates = periodStarts.length ? periodStarts : buckets.map((_, index) => index)
  const spacing = trackWidth / candidates.length
  const needed = Math.ceil(minLabelPx / spacing)
  if (needed <= 1) return candidates
  const stride = NICE_STRIDES.find((s) => s >= needed) ?? needed
  if (granularity === 'year' || granularity === 'decade' || granularity === 'month') {
    const divisor = stride * (granularity === 'decade' ? 10 : 1)
    const round = candidates.filter((index) => buckets[index].start.getFullYear() % divisor === 0)
    if (round.length) return round
  }
  return candidates.filter((_, ordinal) => ordinal % stride === 0)
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const sync = () => setWidth(element.getBoundingClientRect().width)
    sync()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(sync)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Step once on press, then keep stepping while held, like a map's own arrows. */
function useHoldToRepeat(step: () => void, disabled: boolean) {
  const stepRef = useRef(step)
  useLayoutEffect(() => {
    stepRef.current = step
  })
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({})
  const stop = useCallback(() => {
    clearTimeout(timers.current.delay)
    clearInterval(timers.current.repeat)
    timers.current = {}
  }, [])
  useEffect(() => stop, [stop])
  useEffect(() => {
    if (disabled) stop()
  }, [disabled, stop])
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled || event.button !== 0) return
      stepRef.current()
      stop()
      timers.current.delay = setTimeout(() => {
        timers.current.repeat = setInterval(() => stepRef.current(), HOLD_REPEAT_MS)
      }, HOLD_DELAY_MS)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // Pointer presses already stepped; keyboard activation arrives as a click with no detail.
    onClick: (event: { detail: number }) => {
      if (event.detail === 0 && !disabled) stepRef.current()
    },
  }
}

const iconButton =
  'flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none'

function OptionGroup<T extends TimelineWindowSize>({
  label,
  options,
  value,
  onChange,
  touch,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  touch: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center rounded-md bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
            touch ? 'h-9 min-w-9' : 'h-6',
            option.value === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * A map timeline: transport, the current window's label, and one track that is
 * both the histogram and the scrubber. It lays itself out from its own width
 * (one row on a wide map, two on a narrow one, a phone layout below that), floats
 * above the map's bottom edge and the phone sheet, and publishes its height as
 * `--map-timeline-height` so the legend, attribution and controls stack above it.
 */
export function MapTimeline({
  buckets,
  value,
  onValueChange,
  label = 'Timeline',
  granularity,
  values,
  formatValue = (v) => v.toLocaleString(),
  valueLabel,
  window: windowMode,
  change,
  summary,
  speeds = DEFAULT_TIMELINE_SPEEDS,
  playing: playingProp,
  onPlayingChange,
  loop = false,
  onClose,
  density: densityProp = 'auto',
  placement = 'map-overlay',
  minLabelPx,
  className,
}: MapTimelineProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [trackRef, trackWidth] = useElementWidth<HTMLDivElement>()
  const [rootWidth, setRootWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const isMobile = useIsMobile()
  const interactions = useWorkspaceInteractions()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const [internalPlaying, setInternalPlaying] = useState(false)
  const [speedMs, setSpeedMs] = useState(
    () => speeds.find((s) => s.intervalMs === 1000)?.intervalMs ?? speeds[0]?.intervalMs ?? 1000,
  )
  const playing = playingProp ?? internalPlaying
  const setPlaying = useCallback(
    (next: boolean) => {
      if (playingProp === undefined) setInternalPlaying(next)
      onPlayingChange?.(next)
    },
    [playingProp, onPlayingChange],
  )

  const count = buckets.length
  const size = windowMode?.size ?? 1
  const anchor = windowMode?.anchor ?? 'start'
  const cumulative = size === 'cumulative'
  const maxIndex = timelineMaxIndex(count, size, anchor)
  const index = Math.min(maxIndex, Math.max(0, value))
  const range = timelineWindow(count, index, size, anchor)

  // Keep the value inside the window's reach when the window or the data changes.
  useEffect(() => {
    if (count && value > maxIndex) onValueChange(maxIndex)
  }, [count, value, maxIndex, onValueChange])

  // ------ layout ------------------------------------------------------------

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const container = root.offsetParent instanceof HTMLElement ? root.offsetParent : root.parentElement
    const sync = () => {
      setRootWidth(root.getBoundingClientRect().width)
      setContainerHeight(container?.getBoundingClientRect().height ?? 0)
    }
    sync()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(sync)
    observer.observe(root)
    if (container) observer.observe(container)
    return () => observer.disconnect()
  }, [])
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  // Phones and touch tablets get 44px targets, whatever layout the width picks.
  const touch = isMobile || coarsePointer
  const shortMap = containerHeight > 0 && containerHeight < SHORT_MAP_HEIGHT
  const density: MapTimelineDensity =
    densityProp === 'auto'
      ? rootWidth
        ? timelineDensityForWidth(rootWidth, touch)
        : isMobile
          ? 'mini'
          : 'full'
      : densityProp

  // Publish the footprint (height plus the gap below it) on every enclosing
  // layout root, so chrome rendered beside the map stacks above it too.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (placement !== 'map-overlay' || !root?.parentElement) return
    const targets = mapCornerTargets(root.parentElement)
    const sync = () => {
      const height = Math.ceil(root.getBoundingClientRect().height)
      for (const target of targets) target.style.setProperty('--map-timeline-height', `calc(${height}px + 0.625rem)`)
    }
    sync()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    observer?.observe(root)
    return () => {
      observer?.disconnect()
      for (const target of targets) target.style.removeProperty('--map-timeline-height')
    }
  }, [placement])

  // Camera framing (fly to a selection) keeps features clear of the timeline.
  useVisibleMapPanel(rootRef, placement === 'map-overlay')

  // The toggle that opens a timeline usually lives in the phone sheet; drop the
  // sheet so the timeline isn't left behind its scrim.
  useEffect(() => {
    if (placement === 'map-overlay' && isMobile) {
      interactions.dispatchEvent(new CustomEvent(MOBILE_MAP_SHEET_COLLAPSE_EVENT))
    }
    // Once, when the timeline opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------ stepping and playback --------------------------------------------

  const latest = useRef({ index, maxIndex, onValueChange, loop })
  useLayoutEffect(() => {
    latest.current = { index, maxIndex, onValueChange, loop }
  })

  const goTo = useCallback((next: number) => {
    const { maxIndex: max, onValueChange: change, index: current } = latest.current
    const clamped = Math.min(max, Math.max(0, next))
    if (clamped !== current) change(clamped)
  }, [])

  const stepBy = useCallback(
    (delta: number) => {
      setPlaying(false)
      goTo(latest.current.index + delta)
    },
    [goTo, setPlaying],
  )

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => {
      const { index: current, maxIndex: max, loop: loops } = latest.current
      if (current < max) goTo(current + 1)
      else if (loops) goTo(0)
      else setPlaying(false)
    }, speedMs)
    return () => clearTimeout(timer)
  }, [playing, index, speedMs, goTo, setPlaying])

  const togglePlay = useCallback(() => {
    if (playing) return setPlaying(false)
    // Play from the end starts over rather than stopping a tick later.
    if (latest.current.index >= latest.current.maxIndex) goTo(0)
    setPlaying(true)
  }, [playing, goTo, setPlaying])

  const prevHold = useHoldToRepeat(() => stepBy(-1), index <= 0)
  const nextHold = useHoldToRepeat(() => stepBy(1), index >= maxIndex)

  // ------ labels -----------------------------------------------------------

  const compactLabels = density !== 'full'
  const windowLabel = formatTimelineWindow(buckets, range, { cumulative, granularity })
  const shownLabel = formatTimelineWindow(buckets, range, {
    cumulative,
    granularity,
    compact: compactLabels,
    tight: density === 'mini' && rootWidth > 0 && rootWidth < 360,
  })

  const changeText = useMemo(() => {
    if (!change || !values) return null
    const offset = Math.max(1, Math.floor(change.offset ?? 1))
    const current = buckets[range.end]
    const previous = buckets[range.end - offset]
    if (!current) return null
    const result = calculatePercentageChange(
      previous ? (values.get(previous.key) ?? 0) : null,
      values.get(current.key) ?? 0,
    )
    return result ? `${change.label ?? 'Change'} ${formatPercentChange(result.percentChange)}` : null
  }, [change, values, buckets, range.end])

  const summaryContent =
    summary || changeText ? (
      <>
        {summary}
        {summary && changeText ? <span aria-hidden="true"> · </span> : null}
        {changeText}
      </>
    ) : null

  // ------ track ------------------------------------------------------------

  const maxValue = useMemo(() => {
    if (!values) return 0
    let max = 0
    for (const bucket of buckets) max = Math.max(max, values.get(bucket.key) ?? 0)
    return max
  }, [values, buckets])

  const ticks = useMemo(
    () => timelineTickIndices(buckets, trackWidth, minLabelPx ?? MIN_LABEL_PX[granularity ?? 'year'], granularity),
    [buckets, trackWidth, minLabelPx, granularity],
  )

  const indexAt = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || !count) return 0
      const rect = track.getBoundingClientRect()
      return Math.min(count - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * count)))
    },
    [count, trackRef],
  )

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setScrubbing(true)
    setPlaying(false)
    const at = indexAt(event.clientX)
    setHoverIndex(at)
    goTo(at)
  }
  const onTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const at = indexAt(event.clientX)
    if (scrubbing) {
      setHoverIndex(at)
      goTo(at)
    } else if (event.pointerType === 'mouse') {
      setHoverIndex(at)
    }
  }
  const endScrub = () => {
    setScrubbing(false)
    setHoverIndex(null)
  }

  const bigStep = granularity === 'month' ? 12 : granularity === 'week' ? 4 : granularity === 'year' ? 10 : 5
  const onTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -bigStep,
      PageUp: bigStep,
    }
    if (event.key in moves) stepBy(moves[event.key])
    else if (event.key === 'Home') stepBy(-count)
    else if (event.key === 'End') stepBy(count)
    else if (event.key === ' ') togglePlay()
    else return
    event.preventDefault()
  }

  // Close the options on an outside press or Escape, and when the layout widens.
  useEffect(() => {
    if (density === 'full') setMenuOpen(false)
  }, [density])
  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (!count) return null

  const percent = (i: number) => `${(i / count) * 100}%`
  const anchorIndex = cumulative || anchor === 'end' ? range.end : range.start
  const tooltipIndex = hoverIndex
  const tooltipBucket = tooltipIndex === null ? null : buckets[tooltipIndex]
  const tooltipValue = tooltipBucket && values ? values.get(tooltipBucket.key) : undefined
  const button = touch ? 'size-11' : density === 'full' ? 'size-8' : 'size-9'
  // Steps and close stay 44px tall on touch but slimmer, leaving the date room.
  const slimButton = touch ? 'h-11 w-9' : button
  const showOptions = Boolean(windowMode?.options.length) || speeds.length > 1
  const speedLabel = speeds.find((s) => s.intervalMs === speedMs)?.label

  const transport = (
    <div className="flex shrink-0 items-center gap-0.5">
      {density === 'full' ? (
        <button
          type="button"
          aria-label="First"
          className={cn(iconButton, button)}
          disabled={index <= 0}
          onClick={() => stepBy(-count)}
        >
          <SkipBack className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Previous"
        className={cn(iconButton, button)}
        disabled={index <= 0}
        {...prevHold}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        aria-pressed={playing}
        className={cn(
          iconButton,
          button,
          'border border-border bg-background text-foreground shadow-sm',
          playing && 'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
        )}
        onClick={togglePlay}
        disabled={count < 2}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <button
        type="button"
        aria-label="Next"
        className={cn(iconButton, slimButton)}
        disabled={index >= maxIndex}
        {...nextHold}
      >
        <ChevronRight className="size-4" />
      </button>
      {density === 'full' ? (
        <button
          type="button"
          aria-label="Latest"
          className={cn(iconButton, button)}
          disabled={index >= maxIndex}
          onClick={() => stepBy(count)}
        >
          <SkipForward className="size-4" />
        </button>
      ) : null}
    </div>
  )

  const closeButton = onClose ? (
    <button type="button" aria-label="Close timeline" className={cn(iconButton, slimButton)} onClick={onClose}>
      <X className="size-4" />
    </button>
  ) : null

  const windowGroup = windowMode?.options.length ? (
    <OptionGroup
      label="Window"
      options={windowMode.options}
      value={windowMode.size}
      onChange={windowMode.onSizeChange}
      touch={touch}
    />
  ) : null
  const speedGroup =
    speeds.length > 1 ? (
      <OptionGroup
        label="Speed"
        options={speeds.map((s) => ({ value: s.intervalMs, label: s.label }))}
        value={speedMs}
        onChange={(next) => setSpeedMs(next as number)}
        touch={touch}
      />
    ) : null

  const dateLabel = (
    <div className="min-w-0 flex-1">
      <div
        title={windowLabel}
        className={cn(
          'truncate font-semibold tabular-nums text-foreground',
          density === 'full' ? 'text-sm' : 'text-[13px] leading-tight',
        )}
      >
        {shownLabel}
      </div>
      {summaryContent && density !== 'full' ? (
        <div className="truncate text-[11px] leading-tight text-muted-foreground">{summaryContent}</div>
      ) : null}
    </div>
  )

  return (
    <div
      ref={rootRef}
      data-map-timeline=""
      data-density={density}
      className={cn(
        placement === 'map-overlay'
          ? cn(
              'absolute inset-x-2.5 mx-auto max-w-[64rem] bottom-[calc(var(--map-mobile-sheet-visible-height,0px)_+_var(--map-safe-bottom-offset,0px)_+_0.625rem)]',
              MAP_OVERLAY_Z.passiveOverlay,
            )
          : 'relative w-full',
        'rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur',
        density === 'full' ? 'px-3 pb-2 pt-2.5' : 'px-2.5 pb-1.5 pt-2',
        className,
      )}
    >
      {/* Header row */}
      <div className={cn('flex items-center', density === 'mini' ? 'gap-1' : 'gap-2')}>
        {transport}
        {density === 'full' ? (
          <>
            <div className="flex min-w-0 flex-1 items-baseline gap-3">
              <span
                title={windowLabel}
                className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums text-foreground"
              >
                {shownLabel}
              </span>
              {summaryContent ? (
                <span className="min-w-0 truncate text-xs text-muted-foreground">{summaryContent}</span>
              ) : null}
            </div>
            {windowGroup}
            {speedGroup}
          </>
        ) : (
          <>
            {dateLabel}
            {showOptions ? (
              <button
                type="button"
                aria-label="Timeline options"
                aria-expanded={menuOpen}
                className={cn(iconButton, slimButton, menuOpen && 'bg-muted text-foreground')}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {speedLabel && speedMs !== 1000 ? (
                  <span className="text-[11px] font-semibold tabular-nums">{speedLabel}</span>
                ) : (
                  <SlidersHorizontal className="size-4" />
                )}
              </button>
            ) : null}
          </>
        )}
        {closeButton}
      </div>

      {/* Narrow layouts swap the track for the options in place, so nothing
          pops up over the map's header on a short screen. */}
      {menuOpen && density !== 'full' ? (
        <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-2 pb-1">
          {windowGroup ? (
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">Window</div>
              {windowGroup}
            </div>
          ) : null}
          {speedGroup ? (
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">Speed</div>
              {speedGroup}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Track: one scrubber that is also the histogram. Hidden, not unmounted,
          while the options show, so its width observer keeps its element. */}
      <div
        className={cn('relative', density === 'full' ? 'mt-2' : 'mt-1.5', menuOpen && density !== 'full' && 'hidden')}
      >
        {tooltipBucket ? (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-background shadow"
            style={{
              left: `clamp(2.5rem, calc(${percent(tooltipIndex! + 0.5)}), calc(100% - 2.5rem))`,
            }}
          >
            {tooltipBucket.label}
            {tooltipValue !== undefined ? ` · ${formatValue(tooltipValue)}${valueLabel ? ` ${valueLabel}` : ''}` : null}
          </div>
        ) : null}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={maxIndex}
          aria-valuenow={index}
          aria-valuetext={windowLabel}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onPointerLeave={() => !scrubbing && setHoverIndex(null)}
          onKeyDown={onTrackKeyDown}
          className={cn(
            'relative cursor-pointer touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
            touch && !shortMap ? 'h-11' : values ? 'h-9' : 'h-7',
          )}
        >
          {/* Window highlight */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 rounded-md bg-primary/10"
            style={{ left: percent(range.start), width: percent(range.end - range.start + 1) }}
          />
          {/* Bars, or a comb of ticks without values */}
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 bottom-1.5 top-1 h-[calc(100%-0.625rem)] w-full overflow-visible"
            viewBox={`0 0 ${count} 1`}
            preserveAspectRatio="none"
          >
            {buckets.map((bucket, i) => {
              const inWindow = i >= range.start && i <= range.end
              const raw = values ? (values.get(bucket.key) ?? 0) : null
              const height =
                raw === null ? 0.3 : maxValue > 0 && raw > 0 ? Math.max(0.08, (raw / maxValue) * 0.95) : 0.03
              return (
                <rect
                  key={bucket.key}
                  x={i + (count > 60 ? 0.05 : 0.15)}
                  width={count > 60 ? 0.9 : 0.7}
                  y={1 - height}
                  height={height}
                  rx={0}
                  className={cn(
                    inWindow ? 'fill-primary' : 'fill-muted-foreground/25',
                    hoverIndex === i && !inWindow && 'fill-muted-foreground/50',
                  )}
                />
              )
            })}
          </svg>
          {/* Baseline */}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-1.5 h-px bg-border" />
          {/* Playhead */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -translate-x-1/2"
            style={{ left: percent(anchorIndex + 0.5) }}
          >
            <div className="mx-auto h-full w-0.5 rounded-full bg-foreground" />
            <div className="absolute bottom-0 left-1/2 size-3 -translate-x-1/2 translate-y-1/3 rounded-full border-2 border-background bg-foreground shadow" />
          </div>
        </div>
        {/* Axis labels */}
        <div aria-hidden="true" className="relative mt-1 h-3.5 overflow-hidden text-[10px] leading-none">
          {ticks.map((i) => {
            const left = (i + 0.5) / count
            return (
              <span
                key={buckets[i].key}
                className={cn(
                  'absolute top-0 whitespace-nowrap tabular-nums',
                  i >= range.start && i <= range.end ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
                style={{
                  left: `${left * 100}%`,
                  // Centred mid-axis, sliding to start or end at the edges so none is clipped.
                  transform: `translateX(-${left * 100}%)`,
                }}
              >
                {buckets[i].tickLabel}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
