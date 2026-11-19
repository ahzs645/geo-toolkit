import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useMap } from './map-context.js'
import { MapRasterLayer, type MapRasterLayerProps } from './layers/raster.js'
import {
  EMPTY_HANDOFF,
  HANDOFF_NOTE_DELAY_MS,
  LAYER_HANDOFF_TIME_LIMIT_MS,
  handoffEntries,
  handoffLayerId,
  holdHandoff,
  promoteHandoff,
  requestHandoff,
  type LayerHandoff,
} from './map-layer-handoff.js'

/** The fields of MapLibre's `sourcedata` event read here. */
interface SourceDataEvent {
  sourceId?: string
  tile?: unknown
}

export interface MapLayerHandoff<T> {
  /** The caller's layer id: the first layer shown takes it, the next `${id}-handoff`, and so on in turn. */
  id: string
  state: LayerHandoff<T>
  requested: { key: string; value: T } | null
  /** The layer on show, for code that moves it in the stack; null while the layer is off. */
  shownLayerId: string | null
  /** The value on show. It lags the requested one while the next is loading. */
  shown: T | null
  /** True while the requested layer is loading behind the shown one. */
  pending: boolean
  promote: (key?: string) => void
}

/**
 * The state of a hand-off between versions of one tile layer (a release of a timeline, a scenario,
 * a year). Call it where the shown layer's id is needed, which may be outside the map; render the
 * layers with `MapRasterHandoff`. `requested` is null while the layer is off.
 *
 * The shown layer stays until the requested one has its tiles for the current view. Two limits, both
 * `timeLimitMs`: a layer still loading after that long is shown as it stands, and once the map has
 * shown an old layer for that long, newer requests wait for the loading one instead of replacing it,
 * so a timeline played faster than its tiles arrive still moves, a whole release at a time.
 */
export function useMapLayerHandoff<T>(
  id: string,
  requested: { key: string; value: T } | null,
  { timeLimitMs = LAYER_HANDOFF_TIME_LIMIT_MS }: { timeLimitMs?: number } = {},
): MapLayerHandoff<T> {
  const [stored, setStored] = useState<LayerHandoff<T>>(EMPTY_HANDOFF)
  const state = requestHandoff(stored, requested?.key ?? null, requested?.value as T)
  // Adjusted during render, as React recommends for state that follows a prop: no frame shows the old.
  if (state !== stored) setStored(state)

  const shownKey = state.shown?.key ?? null
  const incomingKey = state.incoming?.key ?? null
  const waiting = incomingKey !== null
  // Counted from when this layer was first asked to change: replacing the loading one does not restart it.
  useEffect(() => {
    if (!waiting) return
    const timer = setTimeout(() => setStored((current) => holdHandoff(current)), timeLimitMs)
    return () => clearTimeout(timer)
  }, [shownKey, waiting, timeLimitMs])
  // Counted from this layer's own start: its tiles never came.
  useEffect(() => {
    if (incomingKey === null) return
    const timer = setTimeout(() => setStored((current) => promoteHandoff(current, incomingKey)), timeLimitMs)
    return () => clearTimeout(timer)
  }, [incomingKey, timeLimitMs])

  const promote = useCallback((key?: string) => setStored((current) => promoteHandoff(current, key)), [])
  const shownEntry = handoffEntries(state, requested).find((entry) => entry.role === 'shown')
  return {
    id,
    state,
    requested,
    shownLayerId: shownEntry ? handoffLayerId(id, shownEntry.slot) : null,
    shown: shownEntry?.value ?? null,
    pending: waiting,
    promote,
  }
}

/**
 * Raster tile layers that hand over without blanking: a new source loads at opacity 0 behind the
 * shown one, then the two swap in one frame. Never two drawn at once, so a translucent layer does
 * not read darker during the swap, and never more than two mounted.
 *
 * For a change of *source*. A change of place in the stack is a `moveLayer`, which keeps the tiles.
 */
export function MapRasterHandoff<T>({
  handoff,
  layer,
  opacity = 1,
}: {
  handoff: MapLayerHandoff<T>
  /** The layer for a value. Its id, opacity and visibility belong to the hand-off. */
  layer: (value: T) => Omit<MapRasterLayerProps, 'id' | 'opacity' | 'visible'>
  opacity?: number
}) {
  const { map, isLoaded } = useMap()
  const { id, promote } = handoff
  const entries = handoffEntries(handoff.state, handoff.requested)
  const incoming = entries.find((entry) => entry.role === 'incoming')
  const incomingId = incoming ? handoffLayerId(id, incoming.slot) : null
  const incomingKey = incoming?.key ?? null
  const layerIds = entries.map((entry) => handoffLayerId(id, entry.slot)).join('\n')

  // The swap is one frame only if opacity changes at once: MapLibre's default 300 ms transition would
  // fade the incoming layer up over nothing. Set again after a style reload re-adds the layers.
  useEffect(() => {
    if (!map || !isLoaded || !layerIds) return
    const instant = () => {
      for (const layerId of layerIds.split('\n'))
        if (map.getLayer(layerId)) map.setPaintProperty(layerId, 'raster-opacity-transition', { duration: 0, delay: 0 })
    }
    instant()
    map.on('styledata', instant)
    return () => {
      map.off('styledata', instant)
    }
  }, [isLoaded, layerIds, map])

  // A raster source reports loaded before it has asked for a tile, so it counts once a tile of its
  // own has landed and none is still loading. `idle` covers a view that needs none, or only failed ones.
  useEffect(() => {
    if (!map || !isLoaded || !incomingId || !incomingKey) return
    let tiled = false
    const loaded = () => map.getSource(incomingId) !== undefined && map.isSourceLoaded(incomingId)
    const onData = (event: SourceDataEvent) => {
      if (event.sourceId !== incomingId) return
      if (event.tile) tiled = true
      if (tiled && loaded()) promote(incomingKey)
    }
    const onIdle = () => {
      if (map.getSource(incomingId)) promote(incomingKey)
    }
    map.on('sourcedata', onData)
    map.on('idle', onIdle)
    map.triggerRepaint()
    return () => {
      map.off('sourcedata', onData)
      map.off('idle', onIdle)
    }
  }, [incomingId, incomingKey, isLoaded, map, promote])

  return (
    <>
      {entries.map((entry) => (
        <MapRasterLayer
          key={`${entry.slot}:${entry.key}`}
          {...layer(entry.value)}
          id={handoffLayerId(id, entry.slot)}
          opacity={entry.role === 'shown' ? opacity : 0}
        />
      ))}
    </>
  )
}

/**
 * Says, on the map, that it still shows the previous layer, once a hand-off has lasted
 * `delayMs`. For a data layer whose legend or readout already follows the new selection: the
 * map and the words beside it then disagree for as long as the tiles take, and this states it.
 * Render it inside the `<Map>`, beside `MapRasterHandoff`.
 */
export function MapHandoffNote<T>({
  handoff,
  children,
  delayMs = HANDOFF_NOTE_DELAY_MS,
}: {
  handoff: MapLayerHandoff<T>
  /** What to say, e.g. "Loading the new layer. The map still shows the previous one." */
  children: ReactNode
  delayMs?: number
}) {
  const { pending } = handoff
  const [late, setLate] = useState(false)
  // Adjusted during render, so the note goes in the same frame as the swap.
  if (!pending && late) setLate(false)
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => setLate(true), delayMs)
    return () => clearTimeout(timer)
  }, [pending, delayMs])
  if (!pending || !late) return null
  return (
    <div
      role="status"
      data-map-chrome=""
      data-testid="map-handoff-note"
      className="pointer-events-none absolute left-1/2 top-3 z-10 max-w-[min(24rem,calc(100%-6rem))] -translate-x-1/2 rounded-md border border-border bg-background/85 px-2 py-1 text-center text-xs text-muted-foreground shadow-sm backdrop-blur"
    >
      {children}
    </div>
  )
}
