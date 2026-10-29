import { useEffect, useId, useRef } from 'react'
import { useMap, dispatchMobileMapFeatureClick } from '../map-context.js'
import { registerMapLayerOrder } from '../map-layer-order.js'
import { retainGeoJsonSource, updateGeoJsonSource, releaseGeoJsonSource } from '../map-shared-source.js'
import { attachPointerDismiss } from '../map-pointer.js'
import { SELECTION_COLOR } from '../map-styles.js'
import { createClickPopup, featureClickEvent } from './feature-click.js'
import {
  type MapFeatureClickHandler,
  type MapFeatureHtml,
  type MapStyleExpression,
  type MapStyleValue,
} from './types.js'
import type * as MapLibreGL from 'maplibre-gl'
import * as MapLibreGLRuntime from 'maplibre-gl'

export type MapLineLayerProps = {
  /** Disable feature hit testing for lines used only as visual context. */
  interactive?: boolean
  /** GeoJSON FeatureCollection data or a URL MapLibre can fetch */
  data: GeoJSON.FeatureCollection | string
  /** Stable map-local shared source key. */
  sourceKey?: string
  /** Optional GeoJSON tiling simplification tolerance; 0 preserves source vertices. */
  sourceTolerance?: number
  hoverHtml?: (properties: Record<string, unknown>) => string | null
  /** Popup HTML opened at the clicked position. Escape any data you interpolate. */
  clickHtml?: MapFeatureHtml
  /** Draw-order slot shared with the other vector layers; higher draws on top. */
  layerOrder?: number
  /** Optional MapLibre filter, e.g. to draw only the line features of a mixed collection. */
  filter?: MapStyleExpression | null
  /** Line color — static string or MapLibre expression */
  color: MapStyleValue<string>
  /** Line width (default: 2.2) — number or MapLibre expression (e.g. zoom interpolation) */
  width?: MapStyleValue<number>
  /** Line offset in pixels, useful for parallel route lines (default: 0) */
  offset?: MapStyleValue<number>
  /** Line opacity (default: 0.75) — number or MapLibre expression */
  opacity?: MapStyleValue<number>
  /** Dash pattern [dash, gap] */
  dashArray?: number[]
  /** Line join style (default: 'round') */
  lineJoin?: 'round' | 'bevel' | 'miter'
  /** Line cap style (default: 'round') */
  lineCap?: 'round' | 'butt' | 'square'
  /** Feature property used for identification and selection (default: 'id') */
  idProperty?: string
  /** Currently selected feature ID */
  selectedId?: string | number | null
  /** Selection highlight color (default: SELECTION_COLOR) */
  selectionColor?: string
  /** Selection highlight line width (default: computed from width) */
  selectionWidth?: number
  /** Whether the layer is visible (default: true) */
  visible?: boolean
  /** Callback when a feature is clicked — receives its ID, modifier keys with the clicked `lngLat`, and properties */
  onFeatureClick?: MapFeatureClickHandler
}

export function MapLineLayer({
  interactive = true,
  data,
  sourceKey,
  sourceTolerance,
  hoverHtml,
  clickHtml,
  layerOrder,
  filter,
  color,
  width = 2.2,
  offset = 0,
  opacity = 0.75,
  dashArray,
  lineJoin = 'round',
  lineCap = 'round',
  idProperty = 'id',
  selectedId = null,
  selectionColor = SELECTION_COLOR,
  selectionWidth,
  visible = true,
  onFeatureClick,
}: MapLineLayerProps) {
  const { map, isLoaded } = useMap()
  const uid = useId().replace(/:/g, '')
  const sourceId = sourceKey ? `line-shared-${sourceKey}` : `line-src-${uid}`
  const layerId = `line-layer-${uid}`
  const selectedLayerId = `line-sel-${uid}`

  const onClickRef = useRef(onFeatureClick)
  onClickRef.current = onFeatureClick
  const idPropRef = useRef(idProperty)
  idPropRef.current = idProperty
  const hoverHtmlRef = useRef(hoverHtml)
  hoverHtmlRef.current = hoverHtml
  const clickHtmlRef = useRef(clickHtml)
  clickHtmlRef.current = clickHtml
  const filterRef = useRef(filter)
  filterRef.current = filter

  const resolvedSelectionWidth =
    selectionWidth ?? (typeof width === 'number' ? Math.max(width + 2, width * 1.8) : width)

  // Mount: create source + layers
  useEffect(() => {
    if (!isLoaded || !map) return

    retainGeoJsonSource(map, sourceId, undefined, sourceTolerance)

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      ...(filterRef.current && { filter: filterRef.current as never }),
      layout: {
        'line-join': lineJoin,
        'line-cap': lineCap,
      },
      paint: {
        'line-color': color as never,
        'line-width': width as never,
        'line-offset': offset as never,
        'line-opacity': opacity as never,
        ...(dashArray && { 'line-dasharray': dashArray }),
      },
    })

    map.addLayer({
      id: selectedLayerId,
      type: 'line',
      source: sourceId,
      filter: ['==', ['get', idPropRef.current], ''] as never,
      layout: {
        'line-join': lineJoin,
        'line-cap': lineCap,
      },
      paint: {
        'line-color': selectionColor,
        'line-width': resolvedSelectionWidth as never,
        'line-offset': offset as never,
        'line-opacity': 1,
        ...(dashArray && { 'line-dasharray': dashArray }),
      },
    })

    const clickPopup = createClickPopup(map, () => clickHtmlRef.current)
    const handleClick = (event: unknown) => {
      const e = event as Parameters<typeof featureClickEvent>[0] & { preventDefault?: () => void }
      const properties = e.features?.[0]?.properties
      if (clickHtmlRef.current) {
        popup?.remove()
        clickPopup.open(e)
      }
      const id = properties?.[idPropRef.current]
      if (id != null) {
        e.preventDefault?.()
        e.originalEvent?.preventDefault()
        dispatchMobileMapFeatureClick(map)
        onClickRef.current?.(String(id), featureClickEvent(e), properties ?? {})
      }
    }

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
      popup?.remove()
    }
    const popup = hoverHtmlRef.current
      ? new MapLibreGLRuntime.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'mapcn-tooltip pointer-events-none',
          offset: 12,
        })
      : null
    const handleHover = (event: MapLibreGL.MapLayerMouseEvent) => {
      if (!popup || !event.features?.[0]) return
      const html = hoverHtmlRef.current?.(event.features[0].properties ?? {})
      if (!html) {
        popup.remove()
        return
      }
      popup.setLngLat(event.lngLat).setHTML(html).addTo(map)
    }
    const detachDismiss = popup ? attachPointerDismiss(map, () => popup.remove()) : undefined

    if (interactive) {
      map.on('click', layerId, handleClick as never)
      map.on('mouseenter', layerId, handleMouseEnter)
      map.on('mouseleave', layerId, handleMouseLeave)
      if (popup) map.on('mousemove', layerId, handleHover)
    }

    const releaseOrder = registerMapLayerOrder(map, [layerId, selectedLayerId], layerOrder)

    return () => {
      releaseOrder()
      try {
        map.off('click', layerId, handleClick as never)
        map.off('mouseenter', layerId, handleMouseEnter)
        map.off('mouseleave', layerId, handleMouseLeave)
        if (popup) map.off('mousemove', layerId, handleHover)
        detachDismiss?.()
        popup?.remove()
        clickPopup.dispose()

        if (!map.getStyle()) return
        if (map.getLayer(selectedLayerId)) map.removeLayer(selectedLayerId)
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        releaseGeoJsonSource(map, sourceId)
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map, interactive, sourceId, layerOrder])

  // Update source data
  useEffect(() => {
    if (!isLoaded || !map) return
    updateGeoJsonSource(map, sourceId, data)
    // A layerOrder change rebuilds the source, which then needs the data again.
  }, [data, isLoaded, map, sourceId, layerOrder])

  // Update the optional filter without rebuilding the source.
  useEffect(() => {
    if (!isLoaded || !map) return
    if (map.getLayer(layerId)) map.setFilter(layerId, filter as never)
  }, [filter, isLoaded, layerId, map])

  // Update paint when the caller restyles the line.
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return
    map.setPaintProperty(layerId, 'line-color', color as never)
    map.setPaintProperty(layerId, 'line-width', width as never)
    map.setPaintProperty(layerId, 'line-opacity', opacity as never)
  }, [color, isLoaded, layerId, map, opacity, width])

  // Update visibility
  useEffect(() => {
    if (!isLoaded || !map) return
    const vis = visible ? 'visible' : 'none'
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', vis)
    if (map.getLayer(selectedLayerId)) map.setLayoutProperty(selectedLayerId, 'visibility', vis)
  }, [visible, isLoaded, map, layerId, selectedLayerId])

  // Update selection filter
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(selectedLayerId)) return
    map.setFilter(selectedLayerId, ['==', ['get', idProperty], selectedId ?? ''] as never)
  }, [isLoaded, map, selectedLayerId, selectedId, idProperty])

  return null
}
