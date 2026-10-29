// Public layer exports; implementations live in focused modules.
export type {
  MapFeatureId,
  MapStyleExpression,
  MapStyleValue,
  MapFeatureModifiers,
  MapFeatureClickEvent,
  MapFeatureProperties,
  MapFeatureClickHandler,
  MapFeatureHtml,
} from './layers/types.js'
export { MapFillLayer, type MapFillLayerProps } from './layers/fill.js'
export { syncFeatureState, type MapFeatureStateById } from './map-feature-state.js'
export { MapCircleLayer, type MapCircleLayerProps } from './layers/circle.js'
export { MapLineLayer, type MapLineLayerProps } from './layers/line.js'
export { MapGeoJsonLayer, type MapGeoJsonLayerProps } from './layers/geojson.js'
export {
  MapCanvasLayer,
  MapImageLayer,
  boundsToQuad,
  type MapCanvasLayerProps,
  type MapImageLayerProps,
  type MapQuadCoordinates,
  type MapRasterQuadStyle,
} from './layers/canvas.js'
export { MapRasterLayer, type MapRasterLayerProps } from './layers/raster.js'
export { MapHeatmapLayer, type MapHeatmapLayerProps } from './layers/heatmap.js'
export type { ZoomStops, ColorStops } from './layers/heatmap.js'
export {
  MapPieClusterLayer,
  type MapPieClusterLayerProps,
  type PieClusterPointProperties,
} from './layers/pie-cluster.js'
export { MapPmtilesFillLayer, type MapPmtilesFillLayerProps } from './layers/pmtiles-fill.js'
