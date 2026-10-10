import type { StyleSpecification } from 'maplibre-gl'

/** Colors and visibility for Carto/OpenMapTiles basemap layers; source data stays intact. */
export interface BasemapAppearance {
  backgroundColor: string
  waterColor: string
  landcoverColor: string
  buildingColor: string
  countryBoundaryColor: string
  otherBoundaryColor: string
  roadColor: string
  labelColor: string
  labelHaloColor: string
  showWater: boolean
  showLandcover: boolean
  showCountryBoundaries: boolean
  showOtherBoundaries: boolean
  showLabels: boolean
}

/** Recolor a copy of the supplied style, preserving sources, geometry and filters. */
export function buildBasemapStyle(baseStyle: StyleSpecification, design: BasemapAppearance): StyleSpecification {
  const next = JSON.parse(JSON.stringify(baseStyle)) as StyleSpecification

  next.layers = next.layers.map((layer) => {
    const layerId = layer.id.toLowerCase()
    const sourceLayer =
      'source-layer' in layer && typeof layer['source-layer'] === 'string' ? layer['source-layer'].toLowerCase() : ''
    const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>
    const layout = { ...(layer.layout ?? {}) } as Record<string, unknown>

    if (layer.type === 'background') {
      paint['background-color'] = design.backgroundColor
    }

    if (layer.type === 'fill' && (sourceLayer === 'water' || layerId.includes('water'))) {
      layout.visibility = design.showWater ? 'visible' : 'none'
      paint['fill-color'] = design.waterColor
      paint['fill-opacity'] = layerId.includes('shadow') ? 0.22 : 0.9
    }

    if (layer.type === 'fill' && (sourceLayer === 'landcover' || sourceLayer === 'park' || sourceLayer === 'landuse')) {
      layout.visibility = design.showLandcover ? 'visible' : 'none'
      paint['fill-color'] = design.landcoverColor
      paint['fill-opacity'] = sourceLayer === 'landuse' ? 0.42 : 0.68
    }

    if (layer.type === 'fill' && sourceLayer === 'building') {
      paint['fill-color'] = design.buildingColor
      paint['fill-opacity'] = layerId.includes('top') ? 0.72 : 0.5
    }

    if (layer.type === 'line' && sourceLayer === 'boundary') {
      const isCountryBoundary = layerId.includes('country')
      layout.visibility = isCountryBoundary
        ? design.showCountryBoundaries
          ? 'visible'
          : 'none'
        : design.showOtherBoundaries
          ? 'visible'
          : 'none'
      paint['line-color'] = isCountryBoundary ? design.countryBoundaryColor : design.otherBoundaryColor
      paint['line-opacity'] = isCountryBoundary ? 0.72 : 0.48
    }

    if (layer.type === 'line' && sourceLayer === 'transportation' && !layerId.includes('case')) {
      paint['line-color'] = design.roadColor
      paint['line-opacity'] = layerId.includes('rail') ? 0.5 : 0.82
    }

    if (layer.type === 'line' && sourceLayer === 'waterway') {
      layout.visibility = design.showWater ? 'visible' : 'none'
      paint['line-color'] = design.waterColor
      paint['line-opacity'] = 0.76
    }

    if (layer.type === 'symbol') {
      layout.visibility = design.showLabels ? 'visible' : 'none'
      if ('text-color' in paint) {
        paint['text-color'] = sourceLayer.includes('water') ? design.waterColor : design.labelColor
      }
      if ('text-halo-color' in paint) paint['text-halo-color'] = design.labelHaloColor
    }

    return {
      ...layer,
      paint,
      layout,
    }
  })

  return next
}
