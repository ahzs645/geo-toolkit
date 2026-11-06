/** How far a drag on the compass turns and tilts the map, matching MapLibre's own compass. */
const BEARING_DEGREES_PER_PIXEL = 0.8
const PITCH_DEGREES_PER_PIXEL = 0.5

export function compassDragView(start: { bearing: number; pitch: number }, dx: number, dy: number) {
  return {
    bearing: start.bearing + dx * BEARING_DEGREES_PER_PIXEL,
    pitch: start.pitch - dy * PITCH_DEGREES_PER_PIXEL,
  }
}
