import type * as MapLibreGL from 'maplibre-gl'
import * as MapLibreGLRuntime from 'maplibre-gl'
import type { MapFeatureClickEvent, MapFeatureProperties } from './types.js'

type LayerClickEvent = {
  features?: Array<{ properties?: Record<string, unknown> }>
  lngLat?: { lng: number; lat: number }
  originalEvent?: Event & { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
}

/** Modifier keys and the clicked map position of a MapLibre layer click. */
export function featureClickEvent(event: LayerClickEvent): MapFeatureClickEvent {
  const original = event.originalEvent
  return {
    shiftKey: original?.shiftKey === true,
    altKey: original?.altKey === true,
    ctrlKey: original?.ctrlKey === true,
    metaKey: original?.metaKey === true,
    lngLat: event.lngLat ? [event.lngLat.lng, event.lngLat.lat] : null,
  }
}

/**
 * One click popup per layer, anchored where the feature was clicked. Returns a
 * handler for the layer's click event and a dispose function for cleanup.
 */
export function createClickPopup(
  map: MapLibreGL.Map,
  html: () => ((properties: MapFeatureProperties) => string | null) | undefined,
) {
  let popup: MapLibreGLRuntime.Popup | null = null
  const open = (event: LayerClickEvent) => {
    const properties = event.features?.[0]?.properties
    const content = properties ? html()?.(properties) : null
    if (!content || !event.lngLat) return
    popup?.remove()
    popup = new MapLibreGLRuntime.Popup({ offset: 10, className: 'mapcn-popup', maxWidth: '320px' })
      .setLngLat(event.lngLat)
      .setHTML(content)
      .addTo(map)
  }
  const dispose = () => {
    popup?.remove()
    popup = null
  }
  return { open, dispose }
}
