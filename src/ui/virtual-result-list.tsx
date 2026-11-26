import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'

interface VirtualResultListProps<T> {
  items: readonly T[]
  getKey: (item: T) => string
  estimateSize: number
  label: string
  /**
   * Key of a row to bring into view each time this changes, e.g. the selected
   * row after a map click or on a deep link. The row is measured first, so one
   * that grew to show its detail ends up fully visible.
   */
  revealKey?: string | null
  children: (item: T) => ReactNode
}

/** Variable-height results inside MapSidebarShell's existing scroll container. */
export function VirtualResultList<T>({
  items,
  getKey,
  estimateSize,
  label,
  revealKey = null,
  children,
}: VirtualResultListProps<T>) {
  'use no memo'
  // TanStack Virtual exposes a mutable virtualizer; compiler memoization would freeze visible rows.
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const pendingFocus = useRef<number | null>(null)
  const lastRevealKey = useRef<string | null>(null)
  const pendingReveal = useRef<string | null>(null)
  const getScrollElement = useCallback(
    () => listRef.current?.closest<HTMLElement>('[data-map-sidebar-scroll="true"]') ?? null,
    [],
  )
  const focusedIndex = focusedKey === null ? -1 : items.findIndex((item) => getKey(item) === focusedKey)
  // TanStack Virtual memoizes its row positions on `getItemKey`'s identity: a new function makes it
  // throw away the rows it has measured and walk the whole list again, calling `getKey` and allocating
  // a position for every item. Callers pass `getKey` inline, and scrolling re-renders synchronously on
  // each scroll event, so a 30,000-row list did that on every frame. Keep the key function stable while
  // `items` is the same array; a new array (a filter, a sort) is a new list and is walked once.
  const getKeyRef = useRef(getKey)
  getKeyRef.current = getKey
  const getItemKey = useCallback(
    // A queued ResizeObserver entry can refer to a removed row after filtering.
    // Active keys are strings; negative numbers safely identify those stale indexes.
    (index: number) => (index >= 0 && index < items.length ? getKeyRef.current(items[index]) : -Math.abs(index) - 1),
    [items],
  )
  // Each row whose measured height differs from the estimate makes TanStack recompute every row after
  // it, so a list whose estimate is a few pixels off walks to its end for each row scrolled into view.
  // Estimate unmeasured rows at the height measured rows most often have, once a handful agree.
  const learnedSize = useRef<number | null>(null)
  const estimateItemSize = useCallback(() => learnedSize.current ?? estimateSize, [estimateSize])
  // The component opts out of compiler memoization above; this mutable API must remain live.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    getItemKey,
    estimateSize: estimateItemSize,
    scrollMargin,
    // A sticky ListHeader directly above covers whatever is scrolled to the top.
    scrollPaddingStart: stickyHeaderHeight,
    overscan: 5,
    // Scrolling with the mouse must not unmount the keyboard's focused row.
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range)
      return focusedIndex < 0 || indexes.includes(focusedIndex)
        ? indexes
        : [...indexes, focusedIndex].sort((a, b) => a - b)
    },
  })

  useLayoutEffect(() => {
    // Mounted rows are measured as they mount, so after a render their sizes are measured heights.
    learnedSize.current = typicalRowSize(
      virtualizer.getVirtualItems().map((row) => row.size),
      learnedSize.current,
    )
  })

  useLayoutEffect(() => {
    if (focusedKey === null || focusedIndex >= 0) return
    // Filtering can remove the focused row before scrollToIndex's next frame.
    // Replace that navigation intent: its old index would otherwise be clamped
    // into the new results and scroll them back down after the filter resets.
    pendingFocus.current = null
    setFocusedKey(null)
    virtualizer.scrollToOffset(0)
  }, [focusedIndex, focusedKey, virtualizer])

  // Filters/detail cards above the list can change its offset without resizing
  // the scroll viewport. Recompute after each render as well as viewport resize.
  useLayoutEffect(() => {
    const list = listRef.current
    const scroll = getScrollElement()
    if (!list || !scroll) return
    const measure = () => {
      const nextMargin = scroll.scrollTop + list.getBoundingClientRect().top - scroll.getBoundingClientRect().top
      // Combining scrollTop with viewport coordinates can introduce subpixel
      // noise while scrolling. Feeding it back into this layout effect on every
      // render can exceed React's update depth even though the list did not move.
      setScrollMargin((previous) => (Math.abs(previous - nextMargin) < 1 ? previous : nextMargin))
      const header = list.previousElementSibling
      setStickyHeaderHeight(
        header instanceof HTMLElement && getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroll)
    return () => observer.disconnect()
  })

  // Runs after every render: a row outside the virtual window has to be
  // scrolled to before it mounts, and only then can its real height be read.
  useLayoutEffect(() => {
    if (revealKey !== lastRevealKey.current) {
      lastRevealKey.current = revealKey
      pendingReveal.current = revealKey
    }
    if (pendingReveal.current === null) return
    const index = items.findIndex((item) => getKey(item) === pendingReveal.current)
    if (index < 0) return
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    if (!row) {
      virtualizer.scrollToIndex(index, { align: 'auto' })
      return
    }
    pendingReveal.current = null
    virtualizer.measureElement(row)
    const scroller = getScrollElement()
    if (!scroller) return
    // Read the mounted row itself: the virtualizer keeps its old size for this
    // row until the next render, so scrollToIndex would judge a row that just
    // grew by its old height and could leave the new part out of view.
    const port = scroller.getBoundingClientRect()
    const box = row.getBoundingClientRect()
    const top = port.top + stickyHeaderHeight
    if (box.top < top || box.height > port.bottom - top) scroller.scrollTop += box.top - top
    else if (box.bottom > port.bottom) scroller.scrollTop += box.bottom - port.bottom
  })

  useLayoutEffect(() => {
    const index = pendingFocus.current
    if (index === null) return
    const button = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"] button`)
    if (!button) return
    button.focus({ preventScroll: true })
    pendingFocus.current = null
  })

  return (
    <div
      ref={listRef}
      role="list"
      aria-label={label}
      data-virtual-result-list="true"
      style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      onFocusCapture={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
        const item = row ? items[Number(row.dataset.index)] : undefined
        if (item) setFocusedKey(getKey(item))
      }}
      onKeyDown={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
        if (!row || !items.length) return
        const index = Number(row.dataset.index)
        const next =
          event.key === 'ArrowDown'
            ? Math.min(items.length - 1, index + 1)
            : event.key === 'ArrowUp'
              ? Math.max(0, index - 1)
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : null
        if (next === null) return
        event.preventDefault()
        pendingFocus.current = next
        setFocusedKey(getKey(items[next]))
        virtualizer.scrollToIndex(next, { align: 'auto' })
      }}
    >
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          ref={virtualizer.measureElement}
          data-index={row.index}
          role="listitem"
          aria-setsize={items.length}
          aria-posinset={row.index + 1}
          className="absolute left-0 top-0 w-full border-b border-border"
          style={{ transform: `translateY(${row.start - scrollMargin}px)` }}
        >
          {children(items[row.index])}
        </div>
      ))}
    </div>
  )
}

/** Fewest measured rows that must share a height before it replaces the caller's estimate. */
const LEARN_MIN_ROWS = 5

/**
 * The height most measured rows share, or `previous` when fewer than `LEARN_MIN_ROWS` agree. Rows that
 * grew to show a detail are outliers and do not move it.
 */
export function typicalRowSize(sizes: ReadonlyArray<number | undefined>, previous: number | null): number | null {
  const counts = new Map<number, number>()
  for (const size of sizes) if (typeof size === 'number' && size > 0) counts.set(size, (counts.get(size) ?? 0) + 1)
  let best: number | null = null
  let bestCount = 0
  for (const [size, count] of counts) if (count > bestCount) [best, bestCount] = [size, count]
  return bestCount >= LEARN_MIN_ROWS ? best : previous
}
