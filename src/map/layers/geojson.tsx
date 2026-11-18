import { MapCircleLayer } from './circle.js'
import { MapFillLayer } from './fill.js'
import { MapLineLayer } from './line.js'
import type { MapFeatureClickHandler, MapFeatureHtml, MapStyleExpression, MapStyleValue } from './types.js'

const POLYGONS: MapStyleExpression = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]
const LINES: MapStyleExpression = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]
const POINTS: MapStyleExpression = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]]

export type MapGeoJsonLayerProps = {
  /** Any mix of points, lines and polygons, as data or a URL MapLibre can fetch. */
  data: GeoJSON.FeatureCollection | string
  /** One colour for every geometry, or an expression such as ['get', 'color']. */
  color: MapStyleValue<string>
  /** Polygon fill opacity (default: 0.2) */
  fillOpacity?: MapStyleValue<number>
  /** Line and polygon outline width (default: 1.5) */
  lineWidth?: MapStyleValue<number>
  /** Line and polygon outline opacity (default: 0.8) */
  lineOpacity?: number
  /** Point radius (default: 4) */
  pointRadius?: MapStyleValue<number>
  /** Point outline colour (default: white) */
  pointStrokeColor?: MapStyleValue<string>
  /** Draw-order slot for the group; polygons, then lines, then points draw in that order. */
  layerOrder?: number
  /**
   * Where this layer overlaps others that answer the pointer, the higher priority shows its hover card and takes the
   * click; a layer outranked under the pointer shows no card and its click does not fire. Default 0, and layers of
   * equal priority behave as before (the topmost card shows, every layer gets the click). Give a large area that holds
   * smaller things, such as a study area, a lower one, so what sits inside it answers first.
   */
  pickPriority?: number
  idProperty?: string
  visible?: boolean
  hoverHtml?: (properties: Record<string, unknown>) => string | null
  clickHtml?: MapFeatureHtml
  onFeatureClick?: MapFeatureClickHandler
}

/**
 * Draw an arbitrary FeatureCollection — an uploaded overlay, a fetched layer —
 * without first sorting it by geometry: polygons are filled and outlined, lines
 * stroked and points drawn as circles.
 */
export function MapGeoJsonLayer({
  data,
  color,
  fillOpacity = 0.2,
  lineWidth = 1.5,
  lineOpacity = 0.8,
  pointRadius = 4,
  pointStrokeColor = '#ffffff',
  layerOrder,
  pickPriority,
  idProperty,
  visible = true,
  hoverHtml,
  clickHtml,
  onFeatureClick,
}: MapGeoJsonLayerProps) {
  const shared = { data, idProperty, visible, hoverHtml, clickHtml, onFeatureClick, layerOrder, pickPriority }
  return (
    <>
      <MapFillLayer
        {...shared}
        filter={POLYGONS}
        fillColor={color}
        fillOpacity={fillOpacity}
        lineColor={color}
        lineWidth={lineWidth}
        lineOpacity={lineOpacity}
      />
      <MapLineLayer {...shared} filter={LINES} color={color} width={lineWidth} opacity={lineOpacity} />
      <MapCircleLayer
        {...shared}
        filter={POINTS}
        color={color}
        radius={pointRadius}
        opacity={0.85}
        strokeColor={pointStrokeColor}
        strokeWidth={1}
      />
    </>
  )
}
