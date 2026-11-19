/**
 * The view-window rule for a layer that draws one image per view, or reads a bounding box per view
 * (API.md, **View windows**). DOM-free and map-free: the hook in `use-view-window.ts` feeds it
 * the map's bounds; the tests feed it numbers.
 *
 * The rule follows what established map libraries do:
 *
 * - The window read is the view grown by `overscan` (OpenLayers' `ImageWMS` `ratio`, 1.5), so a
 *   small pan needs no read at all.
 * - A window is kept while the view stays inside it at the same resolution level (OpenLayers reuses
 *   its image on the same terms); `edgeShare` asks for the next one a little before the view reaches
 *   the edge.
 * - The next window is asked for while the map is still moving, at most every `throttleMs` (Leaflet's
 *   `GridLayer` `updateInterval`, 200 ms), and once more `settleMs` after the move ends.
 * - The caller keeps drawing what it has until the next window's image is ready, and aborts the read
 *   a newer window supersedes. Nothing here ever hides a picture.
 */

/** West, south, east, north in degrees. */
export type LonLatBounds = [number, number, number, number]

/** A window to read: the view it was made for, grown and snapped, at the view's resolution level. */
export type ViewWindow = {
  /** The area to read and draw, in degrees. */
  bounds: LonLatBounds
  /** The view the window was made for. */
  view: LonLatBounds
  /** The resolution level the caller's `level` gave for that view (a zoom, a pixel size…). */
  level: number | string
  /** Stable text for the bounds and level, for keys and effect dependencies. */
  key: string
}

export type ViewWindowRule = {
  /** The window's width and height over the view's (1 reads exactly the view). */
  overscan: number
  /**
   * Ask for the next window once the view comes within this share of its own width or height of
   * the window's edge. Held to at most the overscan's margin, so a new window always holds its view.
   */
  edgeShare: number
  /** Snap the window outward to this grid in degrees, so nearby views share a window (0: none). */
  gridDeg: number
  /** While the map moves, ask for a new window at most this often. */
  throttleMs: number
  /** After the map stops, check once more after this long. */
  settleMs: number
}

/** OpenLayers' image ratio, Leaflet's update interval, and a settle short enough not to be noticed. */
export const VIEW_WINDOW_DEFAULTS: ViewWindowRule = {
  overscan: 1.5,
  edgeShare: 0.1,
  gridDeg: 0,
  throttleMs: 250,
  settleMs: 100,
}

/** The rule with its parts held in range: overscan at least 1, the edge inside the overscan's margin. */
export function viewWindowRule(rule: Partial<ViewWindowRule> = {}): ViewWindowRule {
  const merged = { ...VIEW_WINDOW_DEFAULTS, ...rule }
  const overscan = Math.max(1, Number.isFinite(merged.overscan) ? merged.overscan : 1)
  return {
    overscan,
    edgeShare: Math.max(0, Math.min(merged.edgeShare, (overscan - 1) / 2)),
    gridDeg: Math.max(0, merged.gridDeg),
    throttleMs: Math.max(0, merged.throttleMs),
    settleMs: Math.max(0, merged.settleMs),
  }
}

/** A view the rule can use: finite, west of east, south of north, on one copy of the world. */
export function isUsableView(view: LonLatBounds | null | undefined): view is LonLatBounds {
  if (!view || !view.every(Number.isFinite)) return false
  const [west, south, east, north] = view
  return west < east && south < north && west >= -180 && east <= 180 && south >= -85 && north <= 85
}

const round = (value: number) => Number(value.toFixed(6))

/** The view grown by `overscan` about its centre, snapped outward to `gridDeg`, kept on the globe. */
export function overscanBounds(view: LonLatBounds, overscan: number, gridDeg = 0): LonLatBounds {
  const [west, south, east, north] = view
  const halfWidth = ((east - west) * overscan) / 2,
    halfHeight = ((north - south) * overscan) / 2
  const cx = (west + east) / 2,
    cy = (south + north) / 2
  let bounds: LonLatBounds = [cx - halfWidth, cy - halfHeight, cx + halfWidth, cy + halfHeight]
  if (gridDeg > 0)
    bounds = [
      Math.floor(round(bounds[0] / gridDeg)) * gridDeg,
      Math.floor(round(bounds[1] / gridDeg)) * gridDeg,
      Math.ceil(round(bounds[2] / gridDeg)) * gridDeg,
      Math.ceil(round(bounds[3] / gridDeg)) * gridDeg,
    ]
  return [
    round(Math.max(-180, bounds[0])),
    round(Math.max(-85, bounds[1])),
    round(Math.min(180, bounds[2])),
    round(Math.min(85, bounds[3])),
  ]
}

/**
 * True while the view, grown by `edgeShare` of its own size on each side, lies inside the window.
 * An edge of the window on the globe's edge does not count against the view.
 */
export function windowHoldsView(window: LonLatBounds, view: LonLatBounds, edgeShare = 0): boolean {
  const [west, south, east, north] = view
  const dx = (east - west) * edgeShare,
    dy = (north - south) * edgeShare
  const eps = 1e-9
  return (
    (west - dx >= window[0] - eps || window[0] <= -180) &&
    (south - dy >= window[1] - eps || window[1] <= -85) &&
    (east + dx <= window[2] + eps || window[2] >= 180) &&
    (north + dy <= window[3] + eps || window[3] >= 85)
  )
}

export function makeViewWindow(view: LonLatBounds, level: number | string, rule: ViewWindowRule): ViewWindow {
  const bounds = overscanBounds(view, rule.overscan, rule.gridDeg)
  return { bounds, view, level, key: `${bounds.join(',')}|${level}` }
}

/** Whether `current` still serves `view` at `level`: same level, view inside with its edge margin. */
export function windowServes(
  current: ViewWindow | null,
  view: LonLatBounds,
  level: number | string,
  rule: ViewWindowRule,
): boolean {
  return !!current && current.level === level && windowHoldsView(current.bounds, view, rule.edgeShare)
}

/** What a layer following the view needs to know. */
export type ViewWindowState = {
  /** The window to read; kept while the view is paused or unusable, null before the first one. */
  window: ViewWindow | null
  /** The view is below the layer's least zoom: a stated state, not a movement. */
  paused: boolean
  /** The map is moving (a window may still be asked for meanwhile). */
  moving: boolean
}

export const NO_VIEW_WINDOW: ViewWindowState = { window: null, paused: false, moving: false }

export type ViewWindowSchedulerOptions = {
  rule?: Partial<ViewWindowRule>
  /** Below this zoom the layer is paused and no window is asked for. */
  minZoom?: number
  /** The view's resolution level: a window is reused only at the same level. Defaults to the whole zoom. */
  level?: (view: LonLatBounds, zoom: number) => number | string
  onChange: (state: ViewWindowState) => void
  now?: () => number
}

/**
 * Turns a stream of views into windows: `move` while the camera moves (throttled, the first window
 * that leaves the old one at once), `settle` when it stops (checked after `settleMs`). Each new
 * state goes to `onChange` once; nothing is published while a view stays inside its window.
 */
export function createViewWindowScheduler({
  rule: ruleInput,
  minZoom = -Infinity,
  level = (_view, zoom) => Math.floor(zoom),
  onChange,
  now = () => Date.now(),
}: ViewWindowSchedulerOptions) {
  const rule = viewWindowRule(ruleInput)
  let state: ViewWindowState = NO_VIEW_WINDOW
  let lastRequestAt = -Infinity
  let pending: { view: LonLatBounds | null; zoom: number } | null = null
  let trailing: ReturnType<typeof setTimeout> | undefined
  let settling: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const publish = (next: ViewWindowState) => {
    if (disposed) return
    if (next.window === state.window && next.paused === state.paused && next.moving === state.moving) return
    state = next
    onChange(state)
  }

  /** The state for this view: the same window when it still serves, else a new one. */
  const stateFor = (view: LonLatBounds | null, zoom: number, moving: boolean): ViewWindowState => {
    if (!(zoom >= minZoom)) return { window: state.window, paused: true, moving }
    if (!isUsableView(view)) return { window: state.window, paused: false, moving }
    const viewLevel = level(view, zoom)
    if (windowServes(state.window, view, viewLevel, rule)) return { window: state.window, paused: false, moving }
    lastRequestAt = now()
    return { window: makeViewWindow(view, viewLevel, rule), paused: false, moving }
  }

  const needsWindow = (view: LonLatBounds | null, zoom: number) =>
    zoom >= minZoom && isUsableView(view) && !windowServes(state.window, view, level(view, zoom), rule)

  const flush = () => {
    trailing = undefined
    if (!pending) return
    const { view, zoom } = pending
    pending = null
    publish(stateFor(view, zoom, state.moving))
  }

  return {
    /** A frame of movement: ask for a window now if one is due, else once the throttle allows. */
    move(view: LonLatBounds | null, zoom: number) {
      if (disposed) return
      clearTimeout(settling)
      settling = undefined
      if (!state.moving) publish({ ...state, moving: true })
      if (!needsWindow(view, zoom)) {
        // Still inside (or paused): drop a stale trailing request, but say so if paused changed.
        pending = null
        clearTimeout(trailing)
        trailing = undefined
        const paused = !(zoom >= minZoom)
        if (paused !== state.paused) publish({ ...state, paused })
        return
      }
      pending = { view, zoom }
      const wait = lastRequestAt + rule.throttleMs - now()
      if (wait <= 0) {
        clearTimeout(trailing)
        flush()
      } else if (trailing === undefined) trailing = setTimeout(flush, wait)
    },
    /** The camera stopped (or the map resized): check once more after `settleMs`. */
    settle(view: LonLatBounds | null, zoom: number, delay = rule.settleMs) {
      if (disposed) return
      clearTimeout(trailing)
      trailing = undefined
      pending = null
      clearTimeout(settling)
      const run = () => {
        settling = undefined
        publish(stateFor(view, zoom, false))
      }
      if (delay <= 0) run()
      else settling = setTimeout(run, delay)
    },
    state: () => state,
    dispose() {
      disposed = true
      clearTimeout(trailing)
      clearTimeout(settling)
    },
  }
}

export type ViewWindowScheduler = ReturnType<typeof createViewWindowScheduler>
