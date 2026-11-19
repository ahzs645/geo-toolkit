/**
 * Puts `map.transform` back for deck.gl. `@deck.gl/mapbox` 9.3 reads `map.transform.height` on
 * every frame of an interleaved overlay, and MapLibre 6 moved the transform from the map onto its
 * camera: without this each frame throws "Cannot read properties of undefined (reading 'height')"
 * and no deck.gl layer draws, with only that console error to show for it. MapLibre 5 has the
 * property and is left alone. `useDeckOverlay` calls it; drop it once deck.gl reads the camera.
 */
export function exposeMapTransform(map: object) {
  if ('transform' in map) return
  Object.defineProperty(map, 'transform', {
    configurable: true,
    get(this: { _camera?: { transform?: unknown } }) {
      return this._camera?.transform
    },
  })
}
