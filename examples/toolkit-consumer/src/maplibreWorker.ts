/**
 * Locate MapLibre 6's tile worker for Vite.
 *
 * MapLibre 6 finds its worker at run time with a URL Vite cannot see, so
 * without this the worker 404s, no source loads and the map never goes idle.
 * `?url` makes Vite emit the worker and hand back its address. Import this
 * first in the app's entry, before any map exists; the toolkit shares the same
 * MapLibre module, so the setting reaches its maps too. (An alias that rewrote
 * `maplibre-gl` to a module with this import broke installed consumers: Vite
 * pre-bundles the toolkit there, and its pre-bundler cannot load `?url`.)
 */

import { prewarm, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

setWorkerUrl(workerUrl)
prewarm()
