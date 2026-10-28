import type { StyleSpecification } from 'maplibre-gl'

export interface GeoJsonBasemapOptions {
  /** Land polygons (e.g. Natural Earth countries) as data or a URL the browser can fetch. */
  land: GeoJSON.FeatureCollection | string
  /** Sea / background colour. */
  water?: string
  landColor?: string
  /** Country outlines; omit or set width 0 for none. */
  borderColor?: string
  borderWidth?: number
  /** Graticule spacing in degrees, or false for none (default). */
  graticule?: number | false
  graticuleColor?: string
}

/**
 * Meridians and parallels every `step` degrees, as lines MapLibre can draw.
 * Parallels stop at ±80° so Web Mercator does not stretch them off the map.
 */
export function graticuleLines(step = 30): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const spacing = Number.isFinite(step) && step > 0 ? step : 30
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = []
  const line = (coordinates: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates },
  })
  for (let lon = -180; lon <= 180; lon += spacing) {
    const coordinates: [number, number][] = []
    for (let lat = -80; lat <= 80; lat += 5) coordinates.push([lon, lat])
    features.push(line(coordinates))
  }
  for (let lat = -spacing * Math.floor(80 / spacing); lat <= 80; lat += spacing) {
    const coordinates: [number, number][] = []
    for (let lon = -180; lon <= 180; lon += 5) coordinates.push([lon, lat])
    features.push(line(coordinates))
  }
  return { type: 'FeatureCollection', features }
}

/**
 * A complete MapLibre style drawn from one GeoJSON land layer: no tile server,
 * glyphs or sprites, so it works offline and in static exports. Label sites with
 * markers; a style without glyphs cannot draw symbol layers.
 */
export function geojsonBasemapStyle({
  land,
  water = '#eef3f8',
  landColor = '#dfe5ec',
  borderColor = '#ffffff',
  borderWidth = 0.6,
  graticule = false,
  graticuleColor = 'rgba(100,116,139,0.18)',
}: GeoJsonBasemapOptions): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: { 'basemap-land': { type: 'geojson', data: land } },
    layers: [{ id: 'basemap-background', type: 'background', paint: { 'background-color': water } }],
  }
  if (graticule) {
    style.sources['basemap-graticule'] = { type: 'geojson', data: graticuleLines(graticule) }
    style.layers.push({
      id: 'basemap-graticule',
      type: 'line',
      source: 'basemap-graticule',
      paint: { 'line-color': graticuleColor, 'line-width': 0.6 },
    })
  }
  style.layers.push({ id: 'basemap-land', type: 'fill', source: 'basemap-land', paint: { 'fill-color': landColor } })
  if (borderWidth > 0) {
    style.layers.push({
      id: 'basemap-borders',
      type: 'line',
      source: 'basemap-land',
      paint: { 'line-color': borderColor, 'line-width': borderWidth },
    })
  }
  return style
}
