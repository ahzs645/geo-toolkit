import type * as MapLibreGL from 'maplibre-gl'
import { useEffect } from 'react'

/**
 * Moves a layer under `beforeId` when that changes. A move keeps the layer's source and every tile
 * it has loaded; adding the layer again in the new place, as a remount does, drops them, blanks the
 * layer until they return and asks the tile host for all of them again.
 *
 * Declare it after the effect that adds the layer, so the layer exists on the first run (where the
 * move is to the place it was just added at, and changes nothing).
 */
export function useLayerBefore(
  map: MapLibreGL.Map | null,
  ready: boolean,
  layerId: string,
  beforeId: string | undefined,
  /** A layer in a draw-order slot is placed by that slot, never by `beforeId`. */
  skip = false,
) {
  useEffect(() => {
    if (!map || !ready || skip || !beforeId) return
    try {
      if (map.getLayer(layerId) && map.getLayer(beforeId)) map.moveLayer(layerId, beforeId)
    } catch {
      // The style is being torn down.
    }
  }, [map, ready, layerId, beforeId, skip])
}
