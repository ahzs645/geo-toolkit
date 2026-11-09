import * as MapLibreGL from 'maplibre-gl'

/**
 * MapLibre's right-to-left text plugin (@mapbox/mapbox-gl-rtl-text, BSD-2-Clause), pinned.
 * Host it yourself and pass that URL where a site must not load scripts from a CDN.
 */
export const DEFAULT_RTL_TEXT_PLUGIN_URL =
  'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js'

/**
 * Register MapLibre's RTL text plugin once per page. Without it, Arabic, Hebrew and other
 * right-to-left labels in a basemap draw as unjoined letters in reverse order.
 *
 * The plugin is loaded lazily, only once a right-to-left label is on screen, so maps that never
 * show one never download it. MapLibre accepts a single registration per page: once any plugin is
 * registered (by this or by the host), later calls do nothing. A plugin that fails to load leaves
 * those labels as they were without it and does not affect the map.
 */
export function ensureRtlTextPlugin(url: string = DEFAULT_RTL_TEXT_PLUGIN_URL): void {
  if (typeof window === 'undefined') return
  if (MapLibreGL.getRTLTextPluginStatus() !== 'unavailable') return
  // A relative URL would be resolved against the worker, not the page.
  const absolute = new URL(url, document.baseURI).href
  MapLibreGL.setRTLTextPlugin(absolute, true).catch((error: unknown) => {
    console.warn('[geo-toolkit] The RTL text plugin did not load; right-to-left labels may draw incorrectly.', error)
  })
}
