import type * as MapLibreGL from 'maplibre-gl'
import { useEffect } from 'react'

import { useMap } from '../map-context.js'

export type MapTerrainProps = {
  /** Elevation tiles. Hillshade and 3D terrain each get their own source from this. */
  dem: {
    tiles: string[]
    encoding: 'terrarium' | 'mapbox'
    tileSize?: number
    maxZoom?: number
    attribution?: string
  }
  /** Prefix for the layer and source ids, e.g. `forestry` gives `forestry-hillshade`. */
  id?: string
  /** Lifts the basemap onto 3D terrain. Off, only the hillshade is drawn. */
  terrain?: boolean
  /**
   * Draw only the hillshade and leave the map's terrain and sky alone, for a map where
   * something else owns them, such as a point-cloud viewer. `terrain` is then ignored.
   */
  reliefOnly?: boolean
  /**
   * Lift the map onto 3D terrain and draw nothing else: no hillshade, and the sky and
   * atmosphere stay as the map set them, which a globe view relies on.
   */
  terrainOnly?: boolean
  /** Draw the hillshade below this layer, when it exists. Defaults to under the labels. */
  beforeId?: string
  hillshade?: boolean
  exaggeration?: number
  /** How hard the relief shading is driven, 0–1. */
  hillshadeIntensity?: number
  hillshadeShadowColor?: string
  hillshadeHighlightColor?: string
  /** Sky drawn while `terrain` is on. Off, the atmosphere is blended away. */
  sky?: MapLibreGL.SkySpecification
  /** Replaces the style's background colour while `terrain` is on. */
  terrainGroundColor?: string
}

type TerrainCleanupMap = Pick<
  MapLibreGL.Map,
  'getTerrain' | 'setTerrain' | 'getLayer' | 'removeLayer' | 'getSource' | 'removeSource'
>

/**
 * Release what `MapTerrain` added: terrain before the source it reads from, then the hillshade.
 * A map removed before this cleanup runs (React runs a removed tree's cleanups parent first, so a
 * `Map` unmounted with its terrain is gone already) has nothing left to release, and its methods
 * throw; that is not an error.
 */
export function releaseMapTerrain(
  map: TerrainCleanupMap,
  ids: { hillshadeLayerId: string; hillshadeSourceId: string; terrainSourceId: string },
  options: { reliefOnly: boolean; terrainOnly: boolean },
) {
  try {
    if (
      !options.reliefOnly &&
      (options.terrainOnly ? map.getTerrain()?.source === ids.terrainSourceId : map.getTerrain())
    ) {
      map.setTerrain(null)
    }
    if (map.getLayer(ids.hillshadeLayerId)) map.removeLayer(ids.hillshadeLayerId)
    if (map.getSource(ids.hillshadeSourceId)) map.removeSource(ids.hillshadeSourceId)
    if (!options.reliefOnly && map.getSource(ids.terrainSourceId)) map.removeSource(ids.terrainSourceId)
  } catch {
    // The map was removed first.
  }
}

/** Labels read badly under a hillshade, so it goes below the first symbol layer. */
function firstSymbolLayerId(map: MapLibreGL.Map): string | undefined {
  return map.getStyle()?.layers?.find((layer) => layer.type === 'symbol')?.id
}

/**
 * Relief shading and 3D terrain from one elevation dataset. MapLibre asks for
 * separate sources for the two: sharing one degrades rendering, because each
 * wants its own tile resolution for the same view.
 */
export function MapTerrain({
  dem,
  id = 'map-terrain',
  terrain = false,
  reliefOnly = false,
  terrainOnly = false,
  beforeId,
  hillshade = true,
  exaggeration = 1,
  hillshadeIntensity = 0.45,
  hillshadeShadowColor,
  hillshadeHighlightColor,
  sky,
  terrainGroundColor,
}: MapTerrainProps) {
  const { map, isLoaded } = useMap()
  const hillshadeSourceId = `${id}-dem-hillshade`
  const terrainSourceId = `${id}-dem-terrain`
  const hillshadeLayerId = `${id}-hillshade`
  const { tiles, encoding, tileSize = 256, maxZoom, attribution } = dem
  const tilesKey = tiles.join('|')

  // A style swap (theme change) resets `isLoaded`, which rebuilds these on the new style.
  useEffect(() => {
    if (!isLoaded || !map) return
    const source = {
      type: 'raster-dem' as const,
      tiles: tilesKey.split('|'),
      encoding,
      tileSize,
      ...(maxZoom !== undefined && { maxzoom: maxZoom }),
      ...(attribution && { attribution }),
    }
    if (!terrainOnly && !map.getSource(hillshadeSourceId)) map.addSource(hillshadeSourceId, source)
    if (!reliefOnly && !map.getSource(terrainSourceId)) map.addSource(terrainSourceId, source)
    if (!terrainOnly && !map.getLayer(hillshadeLayerId)) {
      map.addLayer(
        {
          id: hillshadeLayerId,
          type: 'hillshade',
          source: hillshadeSourceId,
          paint: {
            ...(hillshadeShadowColor && { 'hillshade-shadow-color': hillshadeShadowColor }),
            ...(hillshadeHighlightColor && { 'hillshade-highlight-color': hillshadeHighlightColor }),
          },
        },
        beforeId && map.getLayer(beforeId) ? beforeId : firstSymbolLayerId(map),
      )
    }
    return () =>
      releaseMapTerrain(map, { hillshadeLayerId, hillshadeSourceId, terrainSourceId }, { reliefOnly, terrainOnly })
  }, [
    attribution,
    beforeId,
    encoding,
    hillshadeHighlightColor,
    hillshadeLayerId,
    hillshadeShadowColor,
    hillshadeSourceId,
    isLoaded,
    map,
    maxZoom,
    reliefOnly,
    terrainOnly,
    terrainSourceId,
    tileSize,
    tilesKey,
  ])

  useEffect(() => {
    if (reliefOnly || !terrain || !terrainGroundColor || !isLoaded || !map) return
    const backgrounds = map.getStyle().layers.filter((layer) => layer.type === 'background')
    const original = backgrounds.map((layer) => ({
      id: layer.id,
      color: map.getPaintProperty(layer.id, 'background-color'),
    }))
    for (const layer of backgrounds) map.setPaintProperty(layer.id, 'background-color', terrainGroundColor)
    return () => {
      try {
        for (const layer of original)
          if (map.getLayer(layer.id)) map.setPaintProperty(layer.id, 'background-color', layer.color)
      } catch {
        // The map was removed first.
      }
    }
  }, [reliefOnly, terrain, terrainGroundColor, isLoaded, map])

  useEffect(() => {
    if (reliefOnly || !isLoaded || !map || !map.getSource(terrainSourceId)) return
    map.setTerrain(terrain ? { source: terrainSourceId, exaggeration } : null)
    if (!terrainOnly) map.setSky(terrain && sky ? sky : { 'atmosphere-blend': 0 })
  }, [exaggeration, isLoaded, map, reliefOnly, sky, terrain, terrainOnly, terrainSourceId])

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(hillshadeLayerId)) return
    map.setLayoutProperty(hillshadeLayerId, 'visibility', hillshade ? 'visible' : 'none')
    map.setPaintProperty(hillshadeLayerId, 'hillshade-exaggeration', hillshadeIntensity)
  }, [hillshade, hillshadeIntensity, hillshadeLayerId, isLoaded, map])

  return null
}
