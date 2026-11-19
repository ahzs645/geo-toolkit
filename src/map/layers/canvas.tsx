import { useEffect, useId, useRef } from 'react'
import { useMap } from '../map-context.js'
import { registerMapLayerOrder } from '../map-layer-order.js'
import { imageSourceTakesPixels } from './image-pixels.js'
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
  /** Insert before another layer ID when no layerOrder is given, or find it once the style is ready. */
  beforeId?: string | ((map: MapLibreGL.Map) => string | undefined)
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
  /** Stable id for the source and layer, for hosts that look them up. Generated when omitted. */
  id?: string
  /**
   * Gives the host the source for timed drawing it must run itself, such as a crossfade
   * or corners that have to change in the same frame as the pixels. Called with null
   * when the source goes away. Set `revision` aside: the host calls `play` and `pause`.
   */
  onSource?: (source: MapLibreGL.CanvasSource | null) => void
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
  const before = typeof beforeId === 'function' ? beforeId(map) : beforeId
  map.addLayer(
    {
      id: layerId,
      type: 'raster',
      source: sourceId,
      layout: { visibility: visible ? 'visible' : 'none' },
      paint: { 'raster-opacity': opacity, 'raster-resampling': resampling, 'raster-fade-duration': 0 },
    },
    layerOrder === undefined && before && map.getLayer(before) ? before : undefined,
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
export function MapCanvasLayer({
  canvas,
  coordinates,
  revision,
  animate = false,
  id,
  onSource,
  ...style
}: MapCanvasLayerProps) {
  const uid = useId().replace(/:/g, '')
  const sourceId = id ?? `canvas-src-${uid}`
  const layerId = id ?? `canvas-layer-${uid}`
  const hostDrawn = Boolean(onSource)
  const onSourceRef = useRef(onSource)
  const { map, isLoaded } = useRasterQuadLayer(layerId, style)
  const coordinatesKey = JSON.stringify(coordinates)
  const coordinatesRef = useRef(coordinates)
  const styleRef = useRef(style)
  // Declared first so the effects below read this render's values.
  useEffect(() => {
    coordinatesRef.current = coordinates
    styleRef.current = style
    onSourceRef.current = onSource
  })

  useEffect(() => {
    if (!isLoaded || !map || !canvas) return
    map.addSource(sourceId, { type: 'canvas', canvas, coordinates: coordinatesRef.current, animate })
    const remove = addRasterQuadLayer(map, sourceId, layerId, styleRef.current)
    onSourceRef.current?.(map.getSource(sourceId) as MapLibreGL.CanvasSource)
    return () => {
      onSourceRef.current?.(null)
      remove()
    }
  }, [animate, canvas, isLoaded, layerId, map, sourceId, style.layerOrder])

  useEffect(() => {
    if (!isLoaded || !map) return
    const source = map.getSource(sourceId) as MapLibreGL.CanvasSource | undefined
    source?.setCoordinates(coordinatesRef.current)
  }, [coordinatesKey, isLoaded, map, sourceId])

  // A paused canvas source keeps its last texture; play for one frame to upload.
  useEffect(() => {
    if (!isLoaded || !map || animate || hostDrawn) return
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
  }, [animate, canvas, hostDrawn, isLoaded, map, revision, sourceId, coordinatesKey, style.layerOrder])

  return null
}

/** Decoded pixels an image layer can draw without a request or an encode. */
export type MapImagePixels = ImageData | ImageBitmap | HTMLCanvasElement | HTMLImageElement

export type MapImageLayerProps = MapRasterQuadStyle & {
  coordinates: MapQuadCoordinates
  /** Stable id for the source and layer, for hosts that look them up. Generated when omitted. */
  id?: string
  /**
   * Credit shown in the map's attribution while the layer is on. The style spec gives an image
   * source none, but the attribution control reads `source.attribution` from every source in use.
   */
  attribution?: string
} & (
    | {
        /** Image URL (including data: and blob: URLs) */
        url: string
        image?: undefined
      }
    | {
        /**
         * Decoded pixels in place of a URL, for a picture made in the browser: MapLibre uploads
         * them as they are, with no PNG encode, request or decode. An `ImageBitmap` uploads
         * fastest. A new object is a new picture, so keep the same one while nothing changed.
         */
        image: MapImagePixels
        url?: undefined
      }
  )

/** A 1×1 clear GIF: an image source needs a URL to be added with, on every MapLibre. */
const CLEAR_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

/** The pixels as a PNG data URL, for a MapLibre that only takes a URL. */
function pixelsUrl(image: MapImagePixels): string {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context) {
    if (image instanceof ImageData) context.putImageData(image, 0, 0)
    else context.drawImage(image, 0, 0)
  }
  return canvas.toDataURL('image/png')
}

/**
 * Puts a picture and its corners on an image source in one step. MapLibre keeps the old picture at
 * its old corners until the new one is there, so a swap never shows one on the other's corners.
 */
function showImage(
  map: MapLibreGL.Map,
  source: MapLibreGL.ImageSource,
  picture: { url?: string; image?: MapImagePixels; attribution?: string },
  coordinates: MapQuadCoordinates,
) {
  // Set before the picture, so the event that announces it also brings the credit up to date.
  const credited = source as { attribution?: string }
  if (credited.attribution !== picture.attribution) credited.attribution = picture.attribution
  if (picture.image && imageSourceTakesPixels((map as { version?: string }).version)) {
    const update = source.updateImage as unknown as (options: {
      image: MapImagePixels
      coordinates: MapQuadCoordinates
    }) => unknown
    update.call(source, { image: picture.image, coordinates })
    return
  }
  const url = picture.image ? pixelsUrl(picture.image) : picture.url
  if (url) source.updateImage({ url, coordinates })
}

/**
 * A single georeferenced image, such as a published model surface or scanned map. A new `url` or
 * `image`, or new `coordinates`, replaces the picture in place: the layer is never removed for it.
 */
export function MapImageLayer({ url, image, coordinates, id, attribution, ...style }: MapImageLayerProps) {
  const uid = useId().replace(/:/g, '')
  const sourceId = id ?? `image-src-${uid}`
  const layerId = id ?? `image-layer-${uid}`
  const { map, isLoaded } = useRasterQuadLayer(layerId, style)
  const coordinatesKey = JSON.stringify(coordinates)
  const latestRef = useRef({ url, image, attribution, coordinates, style })
  useEffect(() => {
    latestRef.current = { url, image, attribution, coordinates, style }
  })
  const appliedRef = useRef<{
    url?: string
    image?: MapImagePixels
    attribution?: string
    coordinates: string
  } | null>(null)

  useEffect(() => {
    if (!isLoaded || !map) return
    const latest = latestRef.current
    map.addSource(sourceId, { type: 'image', url: latest.url ?? CLEAR_PIXEL, coordinates: latest.coordinates })
    const source = map.getSource(sourceId) as MapLibreGL.ImageSource
    // A URL is already loading and its arrival announces the credit; pixels are shown here.
    if (latest.image) showImage(map, source, latest, latest.coordinates)
    else if (latest.attribution) (source as { attribution?: string }).attribution = latest.attribution
    appliedRef.current = {
      url: latest.url,
      image: latest.image,
      attribution: latest.attribution,
      coordinates: JSON.stringify(latest.coordinates),
    }
    return addRasterQuadLayer(map, sourceId, layerId, latest.style)
  }, [isLoaded, layerId, map, sourceId, style.layerOrder])

  useEffect(() => {
    if (!isLoaded || !map) return
    const applied = appliedRef.current
    if (
      applied &&
      applied.url === url &&
      applied.image === image &&
      applied.attribution === attribution &&
      applied.coordinates === coordinatesKey
    )
      return
    const source = map.getSource(sourceId) as MapLibreGL.ImageSource | undefined
    if (!source) return
    // A credit that changes by itself shows the same picture again: that is what tells the
    // attribution control to read it.
    showImage(map, source, { url, image, attribution }, latestRef.current.coordinates)
    appliedRef.current = { url, image, attribution, coordinates: coordinatesKey }
  }, [attribution, coordinatesKey, image, isLoaded, map, sourceId, url])

  return null
}
