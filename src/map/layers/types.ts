/** Feature identity shared by selection props across vector layer renderers. */
export type MapFeatureId = string | number
/** MapLibre expression tokens; accepts readonly arrays authored with `as const`. */
export type MapStyleExpression = readonly unknown[]
/** A paint property can be a literal or an expression evaluated by MapLibre. */
export type MapStyleValue<T> = T | MapStyleExpression
/** Modifier keys exposed by vector feature selection callbacks. */
export interface MapFeatureModifiers {
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}
/** Modifier keys plus the clicked position, `[longitude, latitude]` (null for synthetic events). */
export interface MapFeatureClickEvent extends MapFeatureModifiers {
  lngLat: [number, number] | null
}
export type MapFeatureProperties = Record<string, unknown>
export type MapFeatureClickHandler = (id: string, event: MapFeatureClickEvent, properties: MapFeatureProperties) => void
/** Popup HTML for a clicked feature; return null to open nothing. Escape any data you interpolate. */
export type MapFeatureHtml = (properties: MapFeatureProperties) => string | null

export const EMPTY_SELECTED_IDS: readonly MapFeatureId[] = []
