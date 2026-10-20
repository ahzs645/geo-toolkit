import type * as MapLibreGL from 'maplibre-gl'

/** Per-feature values keyed by a feature's id (its promoted id property). */
export type MapFeatureStateById = Readonly<Record<string, Readonly<Record<string, unknown>>>>

type FeatureStateTarget = Pick<MapLibreGL.Map, 'setFeatureState'>

function sameValues(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>) {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]))
}

/**
 * Bring a source's feature state from `previous` to `next`, touching only the
 * features whose values changed. Keys that disappear are set to null (MapLibre's
 * unset value), so other state on the same feature, such as hover, is kept.
 */
export function syncFeatureState(
  map: FeatureStateTarget,
  source: string,
  previous: MapFeatureStateById | undefined,
  next: MapFeatureStateById,
) {
  if (previous)
    for (const [id, values] of Object.entries(previous))
      if (!(id in next))
        map.setFeatureState({ source, id }, Object.fromEntries(Object.keys(values).map((key) => [key, null])))
  for (const [id, values] of Object.entries(next)) {
    const before = previous?.[id]
    if (before && sameValues(before, values)) continue
    const cleared = before ? Object.keys(before).filter((key) => !(key in values)) : []
    map.setFeatureState(
      { source, id },
      cleared.length ? { ...Object.fromEntries(cleared.map((key) => [key, null])), ...values } : values,
    )
  }
}
