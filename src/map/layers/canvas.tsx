import { useEffect, useId, useRef } from 'react'
import { useMap } from '../map-context.js'
import { registerMapLayerOrder } from '../map-layer-order.js'
import type * as MapLibreGL from 'maplibre-gl'

/** Image corners as [longitude, latitude]: top-left, top-right, bottom-right, bottom-left. */
export type MapQuadCoordinates = [[number, number], [number, number], [number, number], [number, number]]

/** Corners for an axis-aligned west/south/east/north box, in MapLibre's image-source order. */
export function boundsToQuad({
  west,
  south,
  east,
  north,
}: {
  west: number
  south: number
  east: number
  north: number
}): MapQuadCoordinates {
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ]
}

export type MapRasterQuadStyle = {
  /** Layer opacity from 0 to 1 (default: 0.75) */
  opacity?: number
  /** Pixel resampling; use nearest for classified cells (default: 'linear') */
  resampling?: 'linear' | 'nearest'
  /** Whether the layer is visible (default: true) */
  visible?: boolean
  /** Draw-order slot shared with the vector layers; higher draws on top. */
  layerOrder?: number
  /** Insert before another layer ID when no layerOrder is given. */
  beforeId?: string
}

export type MapCanvasLayerProps = MapRasterQuadStyle & {
  /** The canvas to draw. The host paints it; the layer only places it. */
  canvas: HTMLCanvasElement | null
  coordinates: MapQuadCoordinates
  /**
   * Change after repainting the canvas so the map uploads the new pixels.
   * Ignored when `animate` is set, which re-reads the canvas every frame.
   */
  revision?: unknown
  /** Re-read the canvas on every frame, for continuously animated drawings (default: false). */
  animate?: boolean
}

function useRasterQuadLayer(
  layerId: string,
  { opacity = 0.75, resampling = 'linear', visible = true }: MapRasterQuadStyle,
) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return
    map.setPaintProperty(layerId, 'raster-opacity', opacity)
    map.setPaintProperty(layerId, 'raster-resampling', resampling)
  }, [isLoaded, layerId, map, opacity, resampling])

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  }, [isLoaded, layerId, map, visible])

  return { map, isLoaded }
}

function addRasterQuadLayer(
  map: MapLibreGL.Map,
  sourceId: string,
  layerId: string,
  { opacity = 0.75, resampling = 'linear', visible = true, layerOrder, beforeId }: MapRasterQuadStyle,
) {
  map.addLayer(
    {
      id: layerId,
      type: 'raster',
      source: sourceId,
      layout: { visibility: visible ? 'visible' : 'none' },
      paint: { 'raster-opacity': opacity, 'raster-resampling': resampling, 'raster-fade-duration': 0 },
    },
    layerOrder === undefined && beforeId && map.getLayer(beforeId) ? beforeId : undefined,
  )
  const releaseOrder = registerMapLayerOrder(map, [layerId], layerOrder)
  return () => {
    releaseOrder()
    try {
      if (!map.getStyle()) return
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    } catch {
      // Map already destroyed during unmount
    }
  }
}

/**
 * A host-painted canvas pinned to four map corners, such as an interpolated
 * surface computed off the main thread. Set `revision` after each repaint.
 */
export function MapCanvasLayer({ canvas, coordinates, revision, animate = false, ...style }: MapCanvasLayerProps) {
  const uid = useId().replace(/:/g, '')
  const sourceId = `canvas-src-${uid}`
  const layerId = `canvas-layer-${uid}`
  const { map, isLoaded } = useRasterQuadLayer(layerId, style)
  const coordinatesKey = JSON.stringify(coordinates)
  const coordinatesRef = useRef(coordinates)
  const styleRef = useRef(style)
  // Declared first so the effects below read this render's values.
  useEffect(() => {
    coordinatesRef.current = coordinates
    styleRef.current = style
  })

  useEffect(() => {
    if (!isLoaded || !map || !canvas) return
    map.addSource(sourceId, { type: 'canvas', canvas, coordinates: coordinatesRef.current, animate })
    return addRasterQuadLayer(map, sourceId, layerId, styleRef.current)
  }, [animate, canvas, isLoaded, layerId, map, sourceId, style.layerOrder])

  useEffect(() => {
    if (!isLoaded || !map) return
    const source = map.getSource(sourceId) as MapLibreGL.CanvasSource | undefined
    source?.setCoordinates(coordinatesRef.current)
  }, [coordinatesKey, isLoaded, map, sourceId])

  // A paused canvas source keeps its last texture; play for one frame to upload.
  useEffect(() => {
    if (!isLoaded || !map || animate) return
    const source = map.getSource(sourceId) as MapLibreGL.CanvasSource | undefined
    if (!source) return
    source.play()
    const pause = () => {
      if (map.getSource(sourceId) === source) source.pause()
    }
    map.once('render', pause)
    map.triggerRepaint()
    return () => {
      map.off('render', pause)
    }
  }, [animate, canvas, isLoaded, map, revision, sourceId, coordinatesKey, style.layerOrder])

  return null
}

export type MapImageLayerProps = MapRasterQuadStyle & {
  /** Image URL (including data: and blob: URLs) */
  url: string
  coordinates: MapQuadCoordinates
}

/** A single georeferenced image, such as a published model surface or scanned map. */
export function MapImageLayer({ url, coordinates, ...style }: MapImageLayerProps) {
  const uid = useId().replace(/:/g, '')
  const sourceId = `image-src-${uid}`
  const layerId = `image-layer-${uid}`
  const { map, isLoaded } = useRasterQuadLayer(layerId, style)
  const coordinatesKey = JSON.stringify(coordinates)
  const latestRef = useRef({ url, coordinates, style })
  useEffect(() => {
    latestRef.current = { url, coordinates, style }
  })
  const appliedRef = useRef('')

  useEffect(() => {
    if (!isLoaded || !map) return
    const latest = latestRef.current
    map.addSource(sourceId, { type: 'image', url: latest.url, coordinates: latest.coordinates })
    appliedRef.current = `${latest.url}|${JSON.stringify(latest.coordinates)}`
    return addRasterQuadLayer(map, sourceId, layerId, latest.style)
  }, [isLoaded, layerId, map, sourceId, style.layerOrder])

  useEffect(() => {
    if (!isLoaded || !map) return
    const next = `${url}|${coordinatesKey}`
    if (appliedRef.current === next) return
    const source = map.getSource(sourceId) as MapLibreGL.ImageSource | undefined
    if (!source) return
    source.updateImage({ url, coordinates: latestRef.current.coordinates })
    appliedRef.current = next
  }, [coordinatesKey, isLoaded, map, sourceId, url])

  return null
}
