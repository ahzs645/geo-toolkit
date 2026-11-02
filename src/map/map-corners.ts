/**
 * MapLibre draws its own controls (the attribution, the logo, its scale) into
 * absolutely positioned corner boxes inside the map container. Toolkit chrome
 * that shares a bottom corner — legend panels, zoom controls, floating panels —
 * reads these heights so it stacks above the attribution instead of covering it.
 */
export const MAP_CORNER_HEIGHT_VARS = {
  'bottom-left': '--map-bottom-left-controls-height',
  'bottom-right': '--map-bottom-right-controls-height',
} as const

const CORNER_SELECTORS = {
  'bottom-left': '.maplibregl-ctrl-bottom-left',
  'bottom-right': '.maplibregl-ctrl-bottom-right',
} as const

type Corner = keyof typeof MAP_CORNER_HEIGHT_VARS

/**
 * How far the corner's controls reach up from the map's bottom edge. The
 * corner box itself also holds the compact attribution's top margin, which
 * would leave a gap above it; an empty corner is zero tall, so chrome falls
 * back to its own margin.
 */
function visibleCornerHeight(corner: HTMLElement): number {
  const bottom = corner.getBoundingClientRect().bottom
  let top = bottom
  for (const control of Array.from(corner.children)) {
    const rect = control.getBoundingClientRect()
    if (rect.height > 0) top = Math.min(top, rect.top)
  }
  return Math.ceil(bottom - top)
}

/**
 * Publishes the heights of the map's bottom corner boxes as CSS variables on
 * `targets`, and keeps them current as the compact attribution opens, closes
 * or wraps. Returns a cleanup that disconnects and removes the variables.
 */
export function publishMapCornerHeights(mapContainer: HTMLElement, targets: readonly HTMLElement[]): () => void {
  const corners = (Object.keys(CORNER_SELECTORS) as Corner[]).map((corner) => ({
    variable: MAP_CORNER_HEIGHT_VARS[corner],
    element: mapContainer.querySelector<HTMLElement>(
      `:scope > .maplibregl-control-container > ${CORNER_SELECTORS[corner]}`,
    ),
  }))

  const sync = () => {
    for (const { variable, element } of corners) {
      const height = element ? visibleCornerHeight(element) : 0
      for (const target of targets) target.style.setProperty(variable, `${height}px`)
    }
  }
  sync()

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
  for (const { element } of corners) {
    if (element) observer?.observe(element)
  }

  return () => {
    observer?.disconnect()
    for (const { variable } of corners) {
      for (const target of targets) target.style.removeProperty(variable)
    }
  }
}

/**
 * The layout roots a map's corner heights belong on: the map's own (when it is
 * one) and every enclosing one up to its workspace, since a page may render its
 * legend beside the map rather than inside it.
 */
export function mapCornerTargets(start: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = []
  for (let element: HTMLElement | null = start; element; element = element.parentElement) {
    if (element.dataset.mapLayoutRoot === 'true') targets.push(element)
    if (element.classList.contains('geo-toolkit')) break
  }
  return targets
}
