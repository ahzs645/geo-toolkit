import type * as MapLibreGL from 'maplibre-gl'

/** Whether a registered layer currently shows hover cards (its `hoverHtml` may come and go). */
type HoverLayerEntry = { active: () => boolean }

const hoverLayersByMap = new WeakMap<MapLibreGL.Map, Map<string, HoverLayerEntry>>()

/**
 * Registers a layer that shows hover cards, so that where several such layers overlap only the
 * topmost one under the pointer shows its card. Without this each layer opened its own card, and a
 * point over a polygon showed two cards stacked on each other. Returns the unregister function.
 */
export function registerHoverLayer(map: MapLibreGL.Map, layerId: string, active: () => boolean = () => true) {
  const layers = hoverLayersByMap.get(map) ?? new Map<string, HoverLayerEntry>()
  layers.set(layerId, { active })
  hoverLayersByMap.set(map, layers)
  return () => {
    layers.delete(layerId)
    if (layers.size === 0) hoverLayersByMap.delete(map)
  }
}

/**
 * The hover-card layers of `map` that exist and currently show cards. A layer hidden with
 * `visibility: none` returns no rendered features, so it never wins.
 */
function activeHoverLayerIds(map: MapLibreGL.Map) {
  const layers = hoverLayersByMap.get(map)
  if (!layers) return []
  return [...layers].filter(([id, entry]) => entry.active() && map.getLayer(id)).map(([id]) => id)
}

/**
 * True when `layerId`'s feature is the topmost hover-card feature at `point`, so its card is the
 * one to show. Rendered features come back topmost first. A layer that is the only one with cards
 * always wins, without a query.
 */
export function isTopHoverLayer(map: MapLibreGL.Map, point: MapLibreGL.PointLike | undefined, layerId: string) {
  if (!point) return true
  const ids = activeHoverLayerIds(map)
  if (ids.length < 2 || !ids.includes(layerId)) return true
  return map.queryRenderedFeatures(point, { layers: ids })[0]?.layer?.id === layerId
}
