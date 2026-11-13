/**
 * MapLibre GL, with its worker located for Vite.
 *
 * MapLibre 6 finds its tile worker at run time with a URL Vite cannot see, so
 * without this the worker 404s, no source loads and the map never goes idle.
 * `?url` makes Vite emit the worker and hand back its address. `vite.config.ts`
 * aliases the bare `maplibre-gl` specifier here, so the toolkit and this example
 * share one MapLibre whose worker URL is set before the first map exists.
 */

import { prewarm, setWorkerUrl } from 'maplibre-gl/dist/maplibre-gl.mjs'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

setWorkerUrl(workerUrl)
prewarm()

export * from 'maplibre-gl/dist/maplibre-gl.mjs'
