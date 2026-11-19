import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  createViewWindowScheduler,
  NO_VIEW_WINDOW,
  type LonLatBounds,
  type ViewWindowRule,
  type ViewWindowState,
} from './view-window.js'

export type UseViewWindowOptions = Partial<ViewWindowRule> & {
  /** Follow the map only while true; off, the hook holds no window. */
  enabled: boolean
  /** Below this zoom the layer is paused: no new window, the old one kept. */
  minZoom?: number
  /** The view's resolution level; a window is reused only at the same level. Defaults to the whole zoom. */
  level?: (view: LonLatBounds, zoom: number) => number | string
}

const viewOf = (map: MapLibreMap): LonLatBounds => {
  const b = map.getBounds()
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
}

/**
 * The window a one-image-per-view (or bounding-box read) layer should read, following the map as it
 * moves (`view-window.ts`, API.md **View windows**). The window changes only
 * when the view leaves it or its resolution level changes: during a move at most every `throttleMs`,
 * and `settleMs` after it ends. Re-renders happen only when the window, `paused` or `moving` changes.
 * The caller keeps its picture up until the next one is ready and aborts reads a new window supersedes.
 */
export function useViewWindow(map: MapLibreMap | null, options: UseViewWindowOptions): ViewWindowState {
  const { enabled, minZoom, overscan, edgeShare, gridDeg, throttleMs, settleMs } = options
  const [owner, setOwner] = useState({ map, enabled })
  const [state, setState] = useState<ViewWindowState>(NO_VIEW_WINDOW)
  if (owner.map !== map || owner.enabled !== enabled) {
    setOwner({ map, enabled })
    setState(NO_VIEW_WINDOW)
  }
  const levelRef = useRef(options.level)
  useEffect(() => {
    levelRef.current = options.level
  })

  useEffect(() => {
    if (!map || !enabled) return
    const scheduler = createViewWindowScheduler({
      rule: { overscan, edgeShare, gridDeg, throttleMs, settleMs },
      minZoom,
      level: (view, zoom) => (levelRef.current ? levelRef.current(view, zoom) : Math.floor(zoom)),
      onChange: setState,
    })
    const move = () => scheduler.move(viewOf(map), map.getZoom())
    const settle = () => scheduler.settle(viewOf(map), map.getZoom())
    map.on('move', move)
    map.on('moveend', settle)
    map.on('resize', settle)
    if (map.isMoving()) move()
    else scheduler.settle(viewOf(map), map.getZoom(), 0)
    return () => {
      scheduler.dispose()
      map.off('move', move)
      map.off('moveend', settle)
      map.off('resize', settle)
    }
  }, [map, enabled, minZoom, overscan, edgeShare, gridDeg, throttleMs, settleMs])

  return enabled && map ? state : NO_VIEW_WINDOW
}
