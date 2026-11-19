import type * as MapLibreGL from 'maplibre-gl'
import { useEffect, useId, useRef, useState } from 'react'
import { useMap } from '../map-context.js'
import { registerMapLayerOrder } from '../map-layer-order.js'
import { useLayerBefore } from './place.js'

export type MapRasterLayerProps = {
  /**
   * Array of tile URL templates — use {z}/{x}/{y} placeholders. A change is followed in place
   * (`setTiles`): the tiles on show stay until each new one arrives, so the layer never blanks.
   * Tiles are replaced one by one, so two versions show side by side meanwhile; a timeline that
   * must change as a whole hands over instead (`MapRasterHandoff`).
   */
  tiles: string[]
  /** Tile size in pixels (default: 256) */
  tileSize?: number
  /** Layer opacity from 0 to 1 (default: 1) */
  opacity?: number
  /** Whether the layer is visible (default: true) */
  visible?: boolean
  /** Minimum zoom level for tile requests (default: 0) */
  minZoom?: number
  /** Maximum zoom level for tile requests (default: 22) */
  maxZoom?: number
  /** Use nearest for classified rasters so class boundaries stay sharp when tiles are enlarged. */
  resampling?: 'linear' | 'nearest'
  /** Crossfade between tiles in ms; 0 for data rasters that must not blend while loading. */
  fadeDuration?: number
  /** Attribution text shown in map corner */
  attribution?: string
  /**
   * Insert this layer before another layer ID (default: added on top). A change moves the layer
   * and keeps its tiles; it is never added again.
   */
  beforeId?: string
  /** Draw-order slot shared with the vector layers; higher draws on top. Overrides beforeId. */
  layerOrder?: number
  /** Limits tile requests to this [west, south, east, north] box. */
  bounds?: [number, number, number, number]
  /** Stable id for the source and layer, for hosts that look them up. Generated when omitted. */
  id?: string
  /**
   * Add the layer as soon as the style is usable rather than after the map's first
   * full load, which waits for every basemap tile. For imagery the map opens to show.
   */
  addOnStyleLoad?: boolean
}

export function MapRasterLayer({
  tiles,
  tileSize = 256,
  opacity = 1,
  visible = true,
  minZoom = 0,
  maxZoom = 22,
  resampling = 'linear',
  fadeDuration,
  attribution,
  beforeId,
  layerOrder,
  bounds,
  id,
  addOnStyleLoad = false,
}: MapRasterLayerProps) {
  const { map, isLoaded: mapLoaded } = useMap()
  const uid = useId().replace(/:/g, '')
  const sourceId = id ?? `raster-src-${uid}`
  const layerId = id ?? `raster-layer-${uid}`
  const [styleLoads, setStyleLoads] = useState(0)
  const tilesKey = tiles.join('\n')
  const sourceTiles = useRef('')
  const isLoaded = mapLoaded || (addOnStyleLoad && styleLoads > 0)

  // A new style drops the source and layer, so they are rebuilt on each load.
  useEffect(() => {
    if (!addOnStyleLoad || !map) return
    const loaded = () => setStyleLoads((count) => count + 1)
    if (map.getStyle()) loaded()
    map.on('style.load', loaded)
    return () => {
      map.off('style.load', loaded)
    }
  }, [addOnStyleLoad, map])

  // Mount: create source + layer
  useEffect(() => {
    if (!isLoaded || !map) return

    map.addSource(sourceId, {
      type: 'raster',
      tiles,
      tileSize,
      minzoom: minZoom,
      maxzoom: maxZoom,
      ...(bounds && { bounds }),
      ...(attribution && { attribution }),
    })
    sourceTiles.current = tilesKey

    map.addLayer(
      {
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': opacity,
          'raster-resampling': resampling,
          ...(fadeDuration !== undefined && { 'raster-fade-duration': fadeDuration }),
        },
      },
      beforeId,
    )
    const releaseOrder = registerMapLayerOrder(map, [layerId], layerOrder)

    return () => {
      releaseOrder()
      try {
        if (!map.getStyle()) return
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map, layerOrder, styleLoads])

  // A new set of tiles reloads in place: MapLibre keeps each old tile drawn until its replacement lands.
  useEffect(() => {
    if (!isLoaded || !map || sourceTiles.current === tilesKey) return
    const source = map.getSource(sourceId) as MapLibreGL.RasterTileSource | undefined
    if (!source || typeof source.setTiles !== 'function') return
    source.setTiles(tilesKey.split('\n'))
    sourceTiles.current = tilesKey
  }, [tilesKey, isLoaded, map, sourceId])

  useLayerBefore(map, isLoaded, layerId, beforeId, layerOrder !== undefined)

  // Update opacity
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return
    map.setPaintProperty(layerId, 'raster-opacity', opacity)
  }, [opacity, isLoaded, map, layerId])

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return
    map.setPaintProperty(layerId, 'raster-resampling', resampling)
  }, [resampling, isLoaded, map, layerId])

  // Update visibility
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  }, [visible, isLoaded, map, layerId])

  return null
}
