import type * as MapLibreGL from 'maplibre-gl'
import { mapCoveredBottom, visibleMapBounds } from './map-resize.js'

export type MapViewportEvent = 'load' | 'moveend' | 'zoomend' | 'resize'
export interface MapViewportSnapshot {
  bounds: [west: number, south: number, east: number, north: number]
  zoom: number
  width: number
  height: number
}

export interface MapViewportObserverOptions {
  events?: readonly MapViewportEvent[]
  initial?: 'always' | 'loaded' | 'none'
}

export const DEFAULT_VIEWPORT_EVENTS: readonly MapViewportEvent[] = ['load', 'moveend', 'zoomend', 'resize']

/** The visible viewport; canvas under a docked layout pane is excluded. */
export function readMapViewport(map: MapLibreGL.Map): MapViewportSnapshot {
  const bounds = visibleMapBounds(map)
  const canvas = map.getCanvas()
  return {
    bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
    zoom: map.getZoom(),
    width: canvas.clientWidth,
    height: Math.max(0, canvas.clientHeight - mapCoveredBottom(map)),
  }
}

/** Subscribe once and return exact cleanup; callers retain the timing policy. */
export function observeMapViewport(
  map: MapLibreGL.Map,
  onChange: (viewport: MapViewportSnapshot) => void,
  { events = DEFAULT_VIEWPORT_EVENTS, initial = 'loaded' }: MapViewportObserverOptions = {},
): () => void {
  const uniqueEvents = [...new Set(events)]
  const update = () => onChange(readMapViewport(map))
  for (const event of uniqueEvents) map.on(event, update)
  if (initial === 'always' || (initial === 'loaded' && map.loaded())) update()
  return () => {
    for (const event of uniqueEvents) map.off(event, update)
  }
}
