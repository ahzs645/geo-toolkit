import type * as MapLibreGL from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_VIEWPORT_EVENTS,
  observeMapViewport,
  type MapViewportSnapshot,
  type MapViewportEvent,
  type MapViewportObserverOptions,
} from './map-viewport.js'

export interface UseMapViewportOptions extends MapViewportObserverOptions {
  enabled?: boolean
  /** Re-publish when an external filter or calculation configuration changes. */
  refreshKey?: unknown
}

/** Observe settled viewport changes without resubscribing for a new callback. */
export function useObserveMapViewport(
  map: MapLibreGL.Map | null,
  onChange: ((viewport: MapViewportSnapshot) => void) | undefined,
  { enabled = true, events = DEFAULT_VIEWPORT_EVENTS, initial = 'loaded', refreshKey }: UseMapViewportOptions = {},
) {
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  }, [onChange])
  const eventKey = [...new Set(events)].join('|')
  const observing = enabled && onChange !== undefined
  useEffect(() => {
    if (!map || !observing) return
    return observeMapViewport(map, (viewport) => callback.current?.(viewport), {
      events: eventKey ? (eventKey.split('|') as MapViewportEvent[]) : [],
      initial,
    })
  }, [map, observing, eventKey, initial, refreshKey])
}

/** React state adapter; high-frequency drawing should subscribe to the map directly. */
export function useMapViewport(
  map: MapLibreGL.Map | null,
  options?: UseMapViewportOptions,
): MapViewportSnapshot | null {
  const [state, setState] = useState<{ map: MapLibreGL.Map; viewport: MapViewportSnapshot } | null>(null)
  useObserveMapViewport(
    map,
    (viewport) => {
      if (map) setState({ map, viewport })
    },
    options,
  )
  return state?.map === map ? state.viewport : null
}
