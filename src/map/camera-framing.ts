export interface CameraInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Insets occupied by edge panels, in the map's own screen coordinate space. */
export function visibleMapInsets(map: ScreenRect, panels: readonly ScreenRect[], gap = 12): CameraInsets {
  const result: CameraInsets = { top: 0, right: 0, bottom: 0, left: 0 }
  const width = Math.max(0, map.right - map.left)
  const height = Math.max(0, map.bottom - map.top)
  for (const panel of panels) {
    const overlapWidth = Math.min(map.right, panel.right) - Math.max(map.left, panel.left)
    const overlapHeight = Math.min(map.bottom, panel.bottom) - Math.max(map.top, panel.top)
    if (overlapWidth <= 0 || overlapHeight <= 0) continue
    if (
      overlapHeight > height * 0.8 &&
      overlapWidth < width * 0.98 &&
      (panel.left <= map.left + 1 || panel.right >= map.right - 1)
    ) {
      // A narrow desktop inspector can cover most of the map's width while
      // still being a side panel. Classify its full-height edge first.
      if (panel.left <= map.left + 1) result.left = Math.max(result.left, panel.right - map.left + gap)
      else result.right = Math.max(result.right, map.right - panel.left + gap)
    } else if (overlapWidth > width / 2) {
      if (panel.bottom >= map.bottom - 1) result.bottom = Math.max(result.bottom, map.bottom - panel.top + gap)
      else if (panel.top <= map.top + 1) result.top = Math.max(result.top, panel.bottom - map.top + gap)
    } else if (overlapHeight > height / 2) {
      if (panel.left <= map.left + 1) result.left = Math.max(result.left, panel.right - map.left + gap)
      else if (panel.right >= map.right - 1) result.right = Math.max(result.right, map.right - panel.left + gap)
    }
  }
  // Even an almost-full sheet must leave a valid destination for the camera.
  result.top = Math.min(result.top, Math.max(0, height - 80))
  result.bottom = Math.min(result.bottom, Math.max(0, height - result.top - 80))
  result.left = Math.min(result.left, Math.max(0, width - 80))
  result.right = Math.min(result.right, Math.max(0, width - result.left - 80))
  return result
}

/** Native camera offset, without leaving persistent MapLibre padding behind. */
export function cameraOffset(insets: CameraInsets): [number, number] {
  return [(insets.left - insets.right) / 2, (insets.top - insets.bottom) / 2]
}
