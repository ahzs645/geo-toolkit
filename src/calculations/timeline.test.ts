import { describe, expect, it } from 'vitest'
import {
  buildTimelineBuckets,
  formatTimelineWindow,
  snapToTimelineBucket,
  timelineBucketKey,
  timelineMaxIndex,
  timelineWindow,
  timelineWindowDates,
} from './timeline.js'
import {
  isTimelinePicker,
  timelineDensityForWidth,
  timelineTickIndices,
  timelineWindowOptions,
} from '../ui/map-timeline.js'

describe('buildTimelineBuckets', () => {
  it('keys months zero-based, as pages already key their counts', () => {
    const buckets = buildTimelineBuckets({
      start: new Date(2023, 10, 15),
      end: new Date(2024, 1, 2),
      granularity: 'month',
    })
    expect(buckets.map((b) => b.key)).toEqual(['2023-10', '2023-11', '2024-00', '2024-01'])
    expect(buckets.map((b) => b.label)).toEqual(['Nov 2023', 'Dec 2023', 'Jan 2024', 'Feb 2024'])
    expect(buckets.filter((b) => b.periodStart).map((b) => b.tickLabel)).toEqual(['2024'])
    expect(timelineBucketKey(new Date(2024, 0, 31), 'month')).toBe('2024-00')
  })

  it('starts weeks on Sunday and labels a month at its first week', () => {
    const buckets = buildTimelineBuckets({
      start: new Date(2025, 9, 1),
      end: new Date(2025, 9, 20),
      granularity: 'week',
    })
    expect(buckets[0].start).toEqual(new Date(2025, 8, 28))
    expect(buckets.map((b) => b.label)).toEqual(['Sep 28, 2025', 'Oct 5, 2025', 'Oct 12, 2025', 'Oct 19, 2025'])
    expect(buckets[1].tickLabel).toBe('Oct 2025')
    expect(buckets[0].key).toBe(timelineBucketKey(new Date(2025, 9, 1), 'week'))
    expect(snapToTimelineBucket(new Date(2025, 9, 22), 'week')).toEqual(new Date(2025, 9, 19))
  })

  it('builds decades and accepts custom labels such as fiscal years', () => {
    const decades = buildTimelineBuckets({ start: new Date(1987, 0), end: new Date(2011, 0), granularity: 'decade' })
    expect(decades.map((b) => b.label)).toEqual(['1980s', '1990s', '2000s', '2010s'])
    const fiscal = buildTimelineBuckets({
      start: new Date(2022, 0),
      end: new Date(2023, 0),
      granularity: 'year',
      formatLabel: (b) => `${b.start.getFullYear()}/${String((b.start.getFullYear() + 1) % 100).padStart(2, '0')}`,
    })
    expect(fiscal.map((b) => b.label)).toEqual(['2022/23', '2023/24'])
    expect(fiscal.map((b) => b.key)).toEqual(['2022', '2023'])
  })
})

describe('timeline windows', () => {
  it('anchors a window at its start, its end, or runs it from the first bucket', () => {
    expect(timelineWindow(10, 4, 3, 'start')).toEqual({ start: 4, end: 6 })
    expect(timelineWindow(10, 4, 3, 'end')).toEqual({ start: 2, end: 4 })
    expect(timelineWindow(10, 1, 3, 'end')).toEqual({ start: 0, end: 1 })
    expect(timelineWindow(10, 4, 'cumulative')).toEqual({ start: 0, end: 4 })
    expect(timelineWindow(10, 99)).toEqual({ start: 9, end: 9 })
  })

  it('stops a start-anchored window while it still fits', () => {
    expect(timelineMaxIndex(10, 3, 'start')).toBe(7)
    expect(timelineMaxIndex(10, 3, 'end')).toBe(9)
    expect(timelineMaxIndex(10, 'cumulative')).toBe(9)
    expect(timelineMaxIndex(2, 5, 'start')).toBe(0)
  })

  it('gives the dates a window covers', () => {
    const buckets = buildTimelineBuckets({ start: new Date(2024, 0), end: new Date(2024, 11), granularity: 'month' })
    const dates = timelineWindowDates(buckets, { start: 1, end: 2 })
    expect(dates?.start).toEqual(new Date(2024, 1, 1))
    expect(dates?.end).toEqual(new Date(2024, 2, 31, 23, 59, 59, 999))
  })

  it('labels windows in full and compact forms', () => {
    const months = buildTimelineBuckets({ start: new Date(2025, 0), end: new Date(2026, 5), granularity: 'month' })
    const range = { start: 8, end: 10 }
    expect(formatTimelineWindow(months, range, { granularity: 'month' })).toBe('Sep 2025 – Nov 2025')
    expect(formatTimelineWindow(months, range, { granularity: 'month', compact: true })).toBe('Sep–Nov 2025')
    expect(formatTimelineWindow(months, { start: 10, end: 13 }, { granularity: 'month', compact: true })).toBe(
      'Nov 2025–Feb 2026',
    )
    expect(formatTimelineWindow(months, { start: 0, end: 8 }, { cumulative: true })).toBe('Through Sep 2025')
    expect(formatTimelineWindow(months, { start: 0, end: 8 }, { cumulative: true, compact: true })).toBe('To Sep 2025')

    const weeks = buildTimelineBuckets({
      start: new Date(2025, 9, 1),
      end: new Date(2025, 10, 20),
      granularity: 'week',
    })
    expect(formatTimelineWindow(weeks, { start: 3, end: 4 }, { granularity: 'week', compact: true })).toBe(
      'Oct 19–26, 2025',
    )
    expect(formatTimelineWindow(weeks, { start: 4, end: 6 }, { granularity: 'week', compact: true })).toBe(
      'Oct 26–Nov 9, 2025',
    )
    expect(formatTimelineWindow(weeks, { start: 4, end: 6 }, { granularity: 'week', tight: true })).toBe('Oct 26–Nov 9')
  })
})

describe('timeline layout', () => {
  it('picks a layout from the timeline’s own width', () => {
    expect(timelineDensityForWidth(1000)).toBe('full')
    expect(timelineDensityForWidth(860)).toBe('compact')
    expect(timelineDensityForWidth(600)).toBe('compact')
    expect(timelineDensityForWidth(360)).toBe('mini')
    expect(timelineDensityForWidth(720, true)).toBe('compact')
  })

  it('fits a picker on one row in less width, since it has fewer controls', () => {
    expect(timelineDensityForWidth(560, false, true)).toBe('full')
    expect(timelineDensityForWidth(540, true, true)).toBe('compact')
    expect(timelineDensityForWidth(560, true, true)).toBe('full')
  })

  it('treats a dozen buckets as a picker and anything longer as a scrubber', () => {
    expect(isTimelinePicker(5)).toBe(true)
    expect(isTimelinePicker(12)).toBe(true)
    expect(isTimelinePicker(13)).toBe(false)
  })

  it('drops fixed windows as long as the data', () => {
    const options = [{ value: 1 }, { value: 2 }, { value: 5 }, { value: 'cumulative' as const }]
    expect(timelineWindowOptions(options, 5, 1).map((o) => o.value)).toEqual([1, 2, 'cumulative'])
    expect(timelineWindowOptions(options, 6, 1).map((o) => o.value)).toEqual([1, 2, 5, 'cumulative'])
  })

  it('keeps the selected window even when it no longer earns its place', () => {
    const options = [{ value: 1 }, { value: 5 }, { value: 'cumulative' as const }]
    expect(timelineWindowOptions(options, 5, 5).map((o) => o.value)).toEqual([1, 5, 'cumulative'])
  })

  it('offers no window for a single bucket', () => {
    expect(timelineWindowOptions([{ value: 1 }, { value: 'cumulative' as const }], 1, 1)).toEqual([])
  })

  it('thins axis labels to round years when they would crowd', () => {
    const years = buildTimelineBuckets({ start: new Date(1990, 0), end: new Date(2024, 0), granularity: 'year' })
    const wide = timelineTickIndices(years, 35 * 60, 40, 'year')
    expect(wide).toHaveLength(35)
    const narrow = timelineTickIndices(years, 200, 40, 'year').map((i) => years[i].label)
    expect(narrow).toEqual(['1990', '2000', '2010', '2020'])
    expect(timelineTickIndices(years, 0, 40, 'year')).toEqual([])
  })
})
