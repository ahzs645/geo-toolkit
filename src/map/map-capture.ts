import type * as MapLibreGL from 'maplibre-gl'

export interface CaptureMapImageOptions {
  /** Image MIME type (default: 'image/png'). */
  type?: string
  /** Encoder quality for lossy types, 0–1. */
  quality?: number
  /**
   * Copies of other canvases to draw over the map, such as a separate deck.gl canvas. WebGL
   * canvases clear between frames too, so the host takes each copy in that renderer's own
   * after-render callback. Empty, or resolving to nothing, leaves just the map.
   */
  overlays?: () => Promise<CanvasImageSource[]>
}

/**
 * Encode the map's current frame. WebGL clears its drawing buffer after each
 * frame is shown, so reading the canvas later returns a blank image unless the
 * map was created with preserveDrawingBuffer. This renders one fresh frame and
 * copies it in the same task, which works without that (costly) option.
 * Captures the WebGL canvas only: HTML markers, popups and legends are not included.
 */
export function captureMapImage(
  map: MapLibreGL.Map,
  { type = 'image/png', quality, overlays }: CaptureMapImageOptions = {},
) {
  return new Promise<Blob>((resolve, reject) => {
    const encode = (canvas: HTMLCanvasElement) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The map canvas did not produce an image'))),
        type,
        quality,
      )
    map.once('render', () => {
      try {
        if (!overlays) {
          encode(map.getCanvas())
          return
        }
        // Copy now: the map's buffer will not outlive this frame while the overlays are read.
        const output = document.createElement('canvas')
        output.width = map.getCanvas().width
        output.height = map.getCanvas().height
        const context = output.getContext('2d')
        if (!context) throw new Error('The map image could not be composed')
        context.drawImage(map.getCanvas(), 0, 0)
        overlays()
          .then((images) => {
            for (const image of images) context.drawImage(image, 0, 0, output.width, output.height)
            encode(output)
          })
          .catch((error: unknown) => reject(error instanceof Error ? error : new Error(String(error))))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    map.triggerRepaint()
  })
}
