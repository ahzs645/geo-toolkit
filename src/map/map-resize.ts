import type * as MapLibreGL from 'maplibre-gl'

type ResizableMap = Pick<MapLibreGL.Map, 'resize' | 'redraw'>

/**
 * Resize a MapLibre map to its container and repaint it before the browser
 * presents the frame.
 *
 * Writing a canvas's `width`/`height` reallocates and clears its WebGL drawing
 * buffer. `map.resize()` only schedules the next render on
 * `requestAnimationFrame`, so on its own the browser composites a cleared canvas
 * first — the map flashes blank on every frame of a panel transition. MapLibre's
 * own `trackResize` observer pairs the two calls for this reason; every resize
 * path in the toolkit goes through here so none of them can skip the redraw.
 *
 * Call it synchronously from a `ResizeObserver` callback or a layout effect.
 * Deferring it to another animation frame reintroduces the blank frame.
 */
export function resizeMap(map: ResizableMap): void {
  map.resize()
  map.redraw()
}

/**
 * Fired on the map after a layout pane changes how much of the canvas it
 * covers. The canvas itself did not resize, so no `resize` event follows.
 */
export const MAP_COVERED_INSETS_CHANGE = 'geo-toolkit:covered-insets'

const coveredBottom = new WeakMap<object, number>()

/** Canvas pixels hidden under a docked layout pane at the bottom of the map. */
export function mapCoveredBottom(map: object): number {
  return coveredBottom.get(map) ?? 0
}

type InsetMap = Pick<MapLibreGL.Map, 'getPadding' | 'project' | 'unproject' | 'getCenter' | 'jumpTo' | 'fire'> & {
  getContainer(): { clientHeight: number }
}

/**
 * Tell the camera that the bottom `next` pixels of the canvas are covered.
 *
 * The amount is added to the map's persistent padding, so `getCenter`,
 * `flyTo`, `easeTo` and `fitBounds` keep working in the visible part of the map
 * exactly as they did when the container itself shrank. The centre moves with
 * the padded centre so the rendered picture does not move: the pane slides over
 * a still map instead of reshaping it. A padding the host set itself is kept.
 */
export function setMapCoveredBottom(map: InsetMap, next: number): void {
  const previous = mapCoveredBottom(map)
  // Even a full-screen pane leaves the camera a valid destination.
  const covered = Math.max(0, Math.min(next, map.getContainer().clientHeight - 80))
  if (Math.abs(covered - previous) < 0.5) return
  const delta = covered - previous
  const padding = map.getPadding()
  const centre = map.project(map.getCenter())
  coveredBottom.set(map, covered)
  map.jumpTo({
    center: map.unproject([centre.x, centre.y - delta / 2]),
    padding: { ...padding, bottom: Math.max(0, (padding.bottom ?? 0) + delta) },
  })
  map.fire(MAP_COVERED_INSETS_CHANGE)
}

export interface VisibleMapBounds {
  west: number
  south: number
  east: number
  north: number
}

/** Bounds of the part of the canvas that is not under a docked layout pane. */
export function visibleMapBounds(
  map: Pick<MapLibreGL.Map, 'getBounds' | 'unproject'> & { getCanvas(): { clientWidth: number; clientHeight: number } },
): VisibleMapBounds {
  const covered = mapCoveredBottom(map)
  if (covered <= 0) {
    const bounds = map.getBounds()
    return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() }
  }
  const { clientWidth: width, clientHeight: height } = map.getCanvas()
  const bottom = Math.max(0, height - covered)
  const corners = [
    map.unproject([0, 0]),
    map.unproject([width, 0]),
    map.unproject([width, bottom]),
    map.unproject([0, bottom]),
  ]
  return {
    west: Math.min(...corners.map((corner) => corner.lng)),
    south: Math.min(...corners.map((corner) => corner.lat)),
    east: Math.max(...corners.map((corner) => corner.lng)),
    north: Math.max(...corners.map((corner) => corner.lat)),
  }
}
