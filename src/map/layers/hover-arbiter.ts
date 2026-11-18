import type * as MapLibreGL from 'maplibre-gl'

/**
 * A layer that answers the pointer: whether it shows hover cards now (its `hoverHtml` may come and go), whether a click
 * on it does anything, and its pick priority.
 */
type PickLayerEntry = { active: () => boolean; clickable: () => boolean; priority: () => number }

export type PickLayerOptions = {
  /** Whether a click on the layer does something (a click card or `onFeatureClick`). */
  clickable?: () => boolean
  /** The layer's `pickPriority`: where layers overlap under the pointer, a higher one answers first. Default 0. */
  priority?: () => number
}

const pickLayersByMap = new WeakMap<MapLibreGL.Map, Map<string, PickLayerEntry>>()

/**
 * Registers a layer that answers the pointer, so that where several such layers overlap only one shows its card: the
 * one with the highest pick priority, then the topmost. Without this each layer opened its own card, and a point over a
 * polygon showed two cards stacked on each other. Returns the unregister function.
 */
export function registerHoverLayer(
  map: MapLibreGL.Map,
  layerId: string,
  active: () => boolean = () => true,
  options: PickLayerOptions = {},
) {
  const layers = pickLayersByMap.get(map) ?? new Map<string, PickLayerEntry>()
  layers.set(layerId, {
    active,
    clickable: options.clickable ?? (() => false),
    priority: options.priority ?? (() => 0),
  })
  pickLayersByMap.set(map, layers)
  return () => {
    layers.delete(layerId)
    if (layers.size === 0) pickLayersByMap.delete(map)
  }
}

/** Registered layers of `map` that exist and pass `keep`. A layer hidden with `visibility: none` returns no rendered
 * features, so it never wins. */
function layersWhere(map: MapLibreGL.Map, keep: (entry: PickLayerEntry) => boolean) {
  const layers = pickLayersByMap.get(map)
  if (!layers) return []
  return [...layers].filter(([id, entry]) => keep(entry) && map.getLayer(id))
}

/**
 * True when `layerId`'s feature is the one under the pointer whose card shows: among the layers showing cards with a
 * feature at `point`, the highest pick priority wins and, among equals, the topmost (rendered features come back
 * topmost first). A layer that is the only one with cards always wins, without a query.
 */
export function isTopHoverLayer(map: MapLibreGL.Map, point: MapLibreGL.PointLike | undefined, layerId: string) {
  if (!point) return true
  const layers = layersWhere(map, (entry) => entry.active())
  if (layers.length < 2 || !layers.some(([id]) => id === layerId)) return true
  const priority = new Map(layers.map(([id, entry]) => [id, entry.priority()]))
  const hits = map.queryRenderedFeatures(point, { layers: layers.map(([id]) => id) })
  let winner: string | undefined
  for (const hit of hits) {
    const id = hit.layer?.id
    if (id && (winner === undefined || priority.get(id)! > priority.get(winner)!)) winner = id
  }
  return winner === layerId
}

/**
 * True when a click at `point` belongs to another layer: one whose click does something, with a feature there and a
 * higher pick priority than `layerId`'s. Layers of equal priority all receive a click, as MapLibre gives it, so this
 * only changes anything once a layer sets a priority; until then it makes no query.
 */
export function isClickOutranked(map: MapLibreGL.Map, point: MapLibreGL.PointLike | undefined, layerId: string) {
  const own = pickLayersByMap.get(map)?.get(layerId)
  if (!point || !own) return false
  const ownPriority = own.priority()
  const above = layersWhere(map, (entry) => entry !== own && entry.clickable() && entry.priority() > ownPriority)
  if (above.length === 0) return false
  return map.queryRenderedFeatures(point, { layers: above.map(([id]) => id) }).length > 0
}
