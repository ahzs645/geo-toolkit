import type * as MapLibreGL from 'maplibre-gl'
import * as MapLibreGLRuntime from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { isClickOutranked, isTopHoverLayer, registerHoverLayer, type PickLayerOptions } from './hover-arbiter.js'

let pmtilesProtocolRegistered = false

type SharedPmtilesTooltipState = {
  ownerLayerId: string | null
  popup: MapLibreGLRuntime.Popup
}

const pmtilesTooltipByMap = new WeakMap<MapLibreGL.Map, SharedPmtilesTooltipState>()

export function ensurePmtilesProtocol() {
  if (pmtilesProtocolRegistered) return
  const protocol = new Protocol()
  MapLibreGLRuntime.addProtocol('pmtiles', protocol.tile)
  pmtilesProtocolRegistered = true
}

/** PMTiles layers share the map-wide hover registry with GeoJSON layers (`hover-arbiter.ts`). */
export function registerPmtilesHoverLayer(map: MapLibreGL.Map, layerId: string, options: PickLayerOptions = {}) {
  return registerHoverLayer(map, layerId, () => true, options)
}

/** Whether a click on a PMTiles layer belongs to a layer of higher pick priority (`hover-arbiter.ts`). */
export function isPmtilesClickOutranked(map: MapLibreGL.Map, point: MapLibreGL.PointLike | undefined, layerId: string) {
  return isClickOutranked(map, point, layerId)
}

export function isTopPmtilesHoverLayer(map: MapLibreGL.Map, point: MapLibreGL.PointLike, layerId: string) {
  return isTopHoverLayer(map, point, layerId)
}

export function showPmtilesTooltip(
  map: MapLibreGL.Map,
  ownerLayerId: string,
  lngLat: MapLibreGL.LngLatLike,
  html: string,
) {
  let state = pmtilesTooltipByMap.get(map)
  if (!state) {
    state = {
      ownerLayerId: null,
      popup: new MapLibreGLRuntime.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'mapcn-tooltip pointer-events-none',
        offset: 12,
      }),
    }
    pmtilesTooltipByMap.set(map, state)
  }

  state.ownerLayerId = ownerLayerId
  state.popup.setLngLat(lngLat).setHTML(html).addTo(map)
}

export function removePmtilesTooltip(map: MapLibreGL.Map, ownerLayerId: string) {
  const state = pmtilesTooltipByMap.get(map)
  if (!state || state.ownerLayerId !== ownerLayerId) return
  state.popup.remove()
  state.ownerLayerId = null
}
