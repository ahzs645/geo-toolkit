import type * as MapLibreGL from 'maplibre-gl'

export interface CaptureMapImageOptions {
  /** Image MIME type (default: 'image/png'). */
  type?: string
  /** Encoder quality for lossy types, 0–1. */
  quality?: number
}

/**
 * Encode the map's current frame. WebGL clears its drawing buffer after each
 * frame is shown, so reading the canvas later returns a blank image unless the
 * map was created with preserveDrawingBuffer. This renders one fresh frame and
 * copies it in the same task, which works without that (costly) option.
 * Captures the WebGL canvas only: HTML markers, popups and legends are not included.
 */
export function captureMapImage(map: MapLibreGL.Map, { type = 'image/png', quality }: CaptureMapImageOptions = {}) {
  return new Promise<Blob>((resolve, reject) => {
    map.once('render', () => {
      try {
        map
          .getCanvas()
          .toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('The map canvas did not produce an image'))),
            type,
            quality,
          )
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    map.triggerRepaint()
  })
}
