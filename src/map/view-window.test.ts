import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createViewWindowScheduler,
  isUsableView,
  makeViewWindow,
  overscanBounds,
  VIEW_WINDOW_DEFAULTS,
  viewWindowRule,
  windowHoldsView,
  windowServes,
  type LonLatBounds,
  type ViewWindowState,
} from './view-window.js'

afterEach(() => vi.useRealTimers())

const VIEW: LonLatBounds = [-122.7, 54.0, -122.6, 54.05]
const pan = ([w, s, e, n]: LonLatBounds, dx: number, dy = 0): LonLatBounds => [w + dx, s + dy, e + dx, n + dy]

describe('view window rule', () => {
  it('grows the view by the overscan about its centre and snaps outward to the grid', () => {
    const window = overscanBounds(VIEW, 1.5)
    expect(window[0]).toBeCloseTo(-122.725, 9)
    expect(window[2]).toBeCloseTo(-122.575, 9)
    expect(window[1]).toBeCloseTo(53.9875, 9)
    expect(window[3]).toBeCloseTo(54.0625, 9)
    expect(overscanBounds(VIEW, 1.5, 0.01)).toEqual([-122.73, 53.98, -122.57, 54.07])
    // Exactly on the grid stays put rather than growing a cell.
    expect(overscanBounds([-122.7, 54, -122.6, 54.1], 1, 0.01)).toEqual([-122.7, 54, -122.6, 54.1])
    expect(overscanBounds([-179.99, 84.9, -179.9, 84.99], 3)).toEqual([-180, 84.81, -179.81, 85])
  })

  it('keeps the edge inside the overscan margin so a new window always holds its own view', () => {
    expect(viewWindowRule({ overscan: 1.5, edgeShare: 0.4 }).edgeShare).toBe(0.25)
    expect(viewWindowRule({ overscan: 0.5 }).overscan).toBe(1)
    const rule = viewWindowRule({ overscan: 1.5, edgeShare: 0.4 })
    const window = makeViewWindow(VIEW, 13, rule)
    expect(windowServes(window, VIEW, 13, rule)).toBe(true)
  })

  it('keeps the default for a part given as undefined, as the hook passes unset options', () => {
    const rule = viewWindowRule({
      overscan: undefined,
      edgeShare: undefined,
      gridDeg: undefined,
      throttleMs: undefined,
      settleMs: undefined,
    })
    expect(rule).toEqual(VIEW_WINDOW_DEFAULTS)
    expect(viewWindowRule({ overscan: 2, throttleMs: undefined })).toMatchObject({ overscan: 2, throttleMs: 250 })
  })

  it('reuses a window while the view stays inside it at the same level, and not otherwise', () => {
    const rule = viewWindowRule({ overscan: 1.5, edgeShare: 0.1 })
    const window = makeViewWindow(VIEW, 10, rule)
    // A tenth of the view's width: inside the margin less the edge.
    expect(windowServes(window, pan(VIEW, 0.01), 10, rule)).toBe(true)
    // Past 0.15 of the view's width the edge is reached.
    expect(windowServes(window, pan(VIEW, 0.016), 10, rule)).toBe(false)
    expect(windowServes(window, VIEW, 20, rule)).toBe(false)
    expect(windowServes(null, VIEW, 10, rule)).toBe(false)
    expect(windowHoldsView([-180, -85, 180, 85], [-180, -85, 180, 85], 0.5)).toBe(true)
  })

  it('refuses views it cannot use', () => {
    expect(isUsableView(VIEW)).toBe(true)
    expect(isUsableView([170, 50, -170, 51])).toBe(false)
    expect(isUsableView([-190, 50, -170, 51])).toBe(false)
    expect(isUsableView([0, 0, Number.NaN, 1])).toBe(false)
    expect(isUsableView(null)).toBe(false)
  })
})

describe('view window scheduler', () => {
  const setup = (minZoom = 12) => {
    vi.useFakeTimers()
    const states: ViewWindowState[] = []
    const scheduler = createViewWindowScheduler({
      rule: { overscan: 1.5, edgeShare: 0.1, throttleMs: 250, settleMs: 100 },
      minZoom,
      level: (_view, zoom) => Math.floor(zoom),
      onChange: (state) => states.push(state),
    })
    return { scheduler, states, windows: () => [...new Set(states.map((s) => s.window).filter(Boolean))] }
  }

  it('publishes the first window at once and nothing more while the view stays inside it', () => {
    const { scheduler, states, windows } = setup()
    scheduler.settle(VIEW, 13, 0)
    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({ paused: false, moving: false })
    expect(states[0].window?.view).toEqual(VIEW)
    for (let i = 1; i <= 10; i++) scheduler.move(pan(VIEW, i * 0.001), 13.2)
    scheduler.settle(pan(VIEW, 0.01), 13.2)
    vi.advanceTimersByTime(100)
    // Moving on, then settled: the same window throughout.
    expect(windows()).toHaveLength(1)
    expect(states.map((s) => s.moving)).toEqual([false, true, false])
  })

  it('asks for the next window during the move, at most once per throttle, then once after it ends', () => {
    const { scheduler, windows } = setup()
    scheduler.settle(VIEW, 13, 0)
    // A drag across the view in 1 s, one frame every 16 ms.
    let view = VIEW
    for (let t = 0; t < 1000; t += 16) {
      view = pan(VIEW, (t / 1000) * 0.1)
      scheduler.move(view, 13)
      vi.advanceTimersByTime(16)
    }
    const during = windows().length - 1
    expect(during).toBeGreaterThanOrEqual(2)
    expect(during).toBeLessThanOrEqual(5)
    // Every window asked for during the move holds the view it was made for.
    for (const window of windows()) expect(windowHoldsView(window!.bounds, window!.view)).toBe(true)
    scheduler.settle(view, 13)
    vi.advanceTimersByTime(99)
    const before = windows().length
    vi.advanceTimersByTime(1)
    const last = windows()[windows().length - 1]!
    expect(windowHoldsView(last.bounds, view)).toBe(true)
    expect(windows().length - before).toBeLessThanOrEqual(1)
  })

  it('leaving the window fires at once when the throttle allows, and a trailing check catches the rest', () => {
    const { scheduler, windows } = setup()
    scheduler.settle(VIEW, 13, 0)
    vi.advanceTimersByTime(1000)
    scheduler.move(pan(VIEW, 0.05), 13)
    expect(windows()).toHaveLength(2)
    scheduler.move(pan(VIEW, 0.1), 13)
    expect(windows()).toHaveLength(2)
    vi.advanceTimersByTime(250)
    expect(windows()).toHaveLength(3)
    expect(windows()[2]!.view).toEqual(pan(VIEW, 0.1))
  })

  it('a zoom that changes the level asks for a window even inside the old one', () => {
    const { scheduler, windows } = setup()
    scheduler.settle(VIEW, 13.9, 0)
    scheduler.settle(VIEW, 14.1, 0)
    expect(windows().map((w) => w!.level)).toEqual([13, 14])
  })

  it('pauses below the least zoom, keeping the window, and resumes without a new one', () => {
    const { scheduler, states, windows } = setup()
    scheduler.settle(VIEW, 13, 0)
    scheduler.move(VIEW, 11.5)
    expect(states[states.length - 1]).toMatchObject({ paused: true, moving: true })
    scheduler.settle(VIEW, 11.5, 0)
    expect(states[states.length - 1]).toMatchObject({ paused: true, moving: false })
    expect(states[states.length - 1].window).toBe(windows()[0])
    scheduler.settle(VIEW, 13.5, 0)
    expect(states[states.length - 1]).toMatchObject({ paused: false, moving: false })
    expect(windows()).toHaveLength(1)
  })

  it('stops publishing once disposed', () => {
    const { scheduler, states } = setup()
    scheduler.settle(VIEW, 13, 0)
    scheduler.move(pan(VIEW, 0.2), 13)
    const count = states.length
    scheduler.dispose()
    vi.advanceTimersByTime(1000)
    scheduler.settle(VIEW, 13, 0)
    expect(states).toHaveLength(count)
  })
})
