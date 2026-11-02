/**
 * Calendar buckets and windows for a map timeline. Pure and DOM-free, so a page
 * can key its own counts the way the timeline does and filter its data with
 * the same window the timeline highlights.
 */

export type TimelineGranularity = 'week' | 'month' | 'year' | 'decade'

/** A window length in buckets, or every bucket up to the current one. */
export type TimelineWindowSize = number | 'cumulative'

export type TimelineWindowAnchor = 'start' | 'end'

export interface TimelineBucket {
  /**
   * Stable key a page uses for its per-bucket values. Months are `YYYY-MM` with
   * a zero-based month (`2024-00` is January), weeks are the ISO date of their
   * local-midnight Sunday, years and decades are the (first) year.
   */
  key: string
  /** Full label, e.g. "Mar 2021", "Oct 19, 2025", "2024", "2020s". */
  label: string
  /** Axis label, e.g. the year at January, "Sep 2025" at a month's first week. */
  tickLabel: string
  /** First bucket of a larger period (a year, a month); the axis labels these first. */
  periodStart: boolean
  start: Date
  end: Date
}

export interface TimelineWindowRange {
  /** First bucket index inside the window. */
  start: number
  /** Last bucket index inside the window. */
  end: number
}

export const TIMELINE_MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** The first instant of the bucket that holds `date`. */
export function snapToTimelineBucket(date: Date, granularity: TimelineGranularity): Date {
  if (granularity === 'decade') return new Date(Math.floor(date.getFullYear() / 10) * 10, 0, 1)
  if (granularity === 'year') return new Date(date.getFullYear(), 0, 1)
  if (granularity === 'week') {
    const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    sunday.setDate(sunday.getDate() - sunday.getDay())
    return sunday
  }
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** The key of the bucket that holds `date`; see {@link TimelineBucket.key}. */
export function timelineBucketKey(date: Date, granularity: TimelineGranularity): string {
  if (granularity === 'decade') return String(Math.floor(date.getFullYear() / 10) * 10)
  if (granularity === 'year') return String(date.getFullYear())
  if (granularity === 'week') return snapToTimelineBucket(date, 'week').toISOString().slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
}

function weekLabel(date: Date): string {
  return `${TIMELINE_MONTH_LABELS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/** Every bucket from the one holding `start` to the one holding `end`, inclusive. */
export function buildTimelineBuckets({
  start,
  end,
  granularity,
  formatLabel,
}: {
  start: Date
  end: Date
  granularity: TimelineGranularity
  /** Replace the full label, e.g. fiscal years ("2024/25") on year buckets. */
  formatLabel?: (bucket: TimelineBucket) => string
}): TimelineBucket[] {
  const buckets: TimelineBucket[] = []
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (granularity === 'decade' || granularity === 'year') {
    const step = granularity === 'decade' ? 10 : 1
    const first = Math.floor(startYear / step) * step
    for (let year = first; year <= endYear; year += step) {
      const label = granularity === 'decade' ? `${year}s` : String(year)
      buckets.push({
        key: String(year),
        label,
        tickLabel: label,
        periodStart: true,
        start: new Date(year, 0, 1),
        end: new Date(year + step - 1, 11, 31, 23, 59, 59, 999),
      })
    }
  } else if (granularity === 'week') {
    const cursor = snapToTimelineBucket(start, 'week')
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    while (cursor <= last) {
      const bucketStart = new Date(cursor)
      const bucketEnd = new Date(cursor)
      bucketEnd.setDate(bucketEnd.getDate() + 6)
      bucketEnd.setHours(23, 59, 59, 999)
      const periodStart = bucketStart.getDate() <= 7
      buckets.push({
        key: bucketStart.toISOString().slice(0, 10),
        label: weekLabel(bucketStart),
        tickLabel: periodStart
          ? `${TIMELINE_MONTH_LABELS[bucketStart.getMonth()]} ${bucketStart.getFullYear()}`
          : String(bucketStart.getDate()),
        periodStart,
        start: bucketStart,
        end: bucketEnd,
      })
      cursor.setDate(cursor.getDate() + 7)
    }
  } else {
    for (let year = startYear; year <= endYear; year++) {
      const firstMonth = year === startYear ? start.getMonth() : 0
      const lastMonth = year === endYear ? end.getMonth() : 11
      for (let month = firstMonth; month <= lastMonth; month++) {
        buckets.push({
          key: `${year}-${String(month).padStart(2, '0')}`,
          label: `${TIMELINE_MONTH_LABELS[month]} ${year}`,
          tickLabel: month === 0 ? String(year) : TIMELINE_MONTH_LABELS[month],
          periodStart: month === 0,
          start: new Date(year, month, 1),
          end: new Date(year, month + 1, 0, 23, 59, 59, 999),
        })
      }
    }
  }

  if (formatLabel) {
    for (const bucket of buckets) bucket.label = formatLabel(bucket)
  }
  return buckets
}

/**
 * The highest index the timeline's value can take. A start-anchored window
 * stops while it still fits; every other window can reach the last bucket.
 */
export function timelineMaxIndex(
  count: number,
  size: TimelineWindowSize = 1,
  anchor: TimelineWindowAnchor = 'start',
): number {
  if (count <= 0) return 0
  if (size === 'cumulative' || anchor === 'end') return count - 1
  return Math.max(0, count - Math.max(1, size))
}

/**
 * The buckets a window covers. `index` is where the window is anchored: its
 * first bucket for a start anchor, its last for an end anchor or a cumulative
 * window (which runs from the first bucket).
 */
export function timelineWindow(
  count: number,
  index: number,
  size: TimelineWindowSize = 1,
  anchor: TimelineWindowAnchor = 'start',
): TimelineWindowRange {
  const last = Math.max(0, count - 1)
  const at = Math.min(last, Math.max(0, Math.round(index)))
  if (size === 'cumulative') return { start: 0, end: at }
  const length = Math.max(1, Math.round(size))
  if (anchor === 'end') return { start: Math.max(0, at - length + 1), end: at }
  return { start: at, end: Math.min(last, at + length - 1) }
}

/** The date span a window covers, for filtering a page's own records. */
export function timelineWindowDates(
  buckets: readonly TimelineBucket[],
  range: TimelineWindowRange,
): { start: Date; end: Date } | null {
  const first = buckets[range.start]
  const last = buckets[range.end]
  return first && last ? { start: first.start, end: last.end } : null
}

function compactRange(
  first: TimelineBucket,
  last: TimelineBucket,
  granularity: TimelineGranularity | undefined,
  tight: boolean,
): string {
  const sameYear = first.start.getFullYear() === last.start.getFullYear()
  if (granularity === 'month') {
    const a = TIMELINE_MONTH_LABELS[first.start.getMonth()]
    const b = TIMELINE_MONTH_LABELS[last.start.getMonth()]
    return sameYear
      ? `${a}–${b} ${last.start.getFullYear()}`
      : `${a} ${first.start.getFullYear()}–${b} ${last.start.getFullYear()}`
  }
  if (granularity === 'week') {
    const a = TIMELINE_MONTH_LABELS[first.start.getMonth()]
    const b = TIMELINE_MONTH_LABELS[last.start.getMonth()]
    const year = tight ? '' : `, ${last.start.getFullYear()}`
    if (sameYear && a === b) return `${a} ${first.start.getDate()}–${last.start.getDate()}${year}`
    if (sameYear) return `${a} ${first.start.getDate()}–${b} ${last.start.getDate()}${year}`
  }
  return `${first.label}–${last.label}`
}

/**
 * The label for a window: one bucket's label, a range, or "Through …" for a
 * cumulative window. `compact` shortens ranges for narrow timelines
 * ("Sep–Nov 2025", "Oct 19–26, 2025", "To Sep 2025"); `tight` also drops the
 * year from a week range within one year ("Oct 19–Nov 2"), for the narrowest
 * phones, where the axis still shows it.
 */
export function formatTimelineWindow(
  buckets: readonly TimelineBucket[],
  range: TimelineWindowRange,
  {
    cumulative = false,
    compact = false,
    tight = false,
    granularity,
  }: { cumulative?: boolean; compact?: boolean; tight?: boolean; granularity?: TimelineGranularity } = {},
): string {
  const first = buckets[range.start]
  const last = buckets[range.end]
  if (!first || !last) return ''
  if (cumulative) return `${compact ? 'To' : 'Through'} ${last.label}`
  if (range.start === range.end) return last.label
  return compact || tight ? compactRange(first, last, granularity, tight) : `${first.label} – ${last.label}`
}
