import type MapLibreGL from 'maplibre-gl'
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
    if (!map.getSource(hillshadeSourceId)) map.addSource(hillshadeSourceId, source)
    if (!map.getSource(terrainSourceId)) map.addSource(terrainSourceId, source)
    if (!map.getLayer(hillshadeLayerId)) {
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
        firstSymbolLayerId(map),
      )
    }
    return () => {
      // Terrain has to be released before the source it reads from.
      if (map.getTerrain()) map.setTerrain(null)
      if (map.getLayer(hillshadeLayerId)) map.removeLayer(hillshadeLayerId)
      if (map.getSource(hillshadeSourceId)) map.removeSource(hillshadeSourceId)
      if (map.getSource(terrainSourceId)) map.removeSource(terrainSourceId)
    }
  }, [
    attribution,
    encoding,
    hillshadeHighlightColor,
    hillshadeLayerId,
    hillshadeShadowColor,
    hillshadeSourceId,
    isLoaded,
    map,
    maxZoom,
    terrainSourceId,
    tileSize,
    tilesKey,
  ])

  useEffect(() => {
    if (!terrain || !terrainGroundColor || !isLoaded || !map) return
    const backgrounds = map.getStyle().layers.filter((layer) => layer.type === 'background')
    const original = backgrounds.map((layer) => ({
      id: layer.id,
      color: map.getPaintProperty(layer.id, 'background-color'),
    }))
    for (const layer of backgrounds) map.setPaintProperty(layer.id, 'background-color', terrainGroundColor)
    return () => {
      for (const layer of original)
        if (map.getLayer(layer.id)) map.setPaintProperty(layer.id, 'background-color', layer.color)
    }
  }, [terrain, terrainGroundColor, isLoaded, map])

  useEffect(() => {
    if (!isLoaded || !map || !map.getSource(terrainSourceId)) return
    map.setTerrain(terrain ? { source: terrainSourceId, exaggeration } : null)
    map.setSky(terrain && sky ? sky : { 'atmosphere-blend': 0 })
  }, [exaggeration, isLoaded, map, sky, terrain, terrainSourceId])

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(hillshadeLayerId)) return
    map.setLayoutProperty(hillshadeLayerId, 'visibility', hillshade ? 'visible' : 'none')
    map.setPaintProperty(hillshadeLayerId, 'hillshade-exaggeration', hillshadeIntensity)
  }, [hillshade, hillshadeIntensity, hillshadeLayerId, isLoaded, map])

  return null
}
