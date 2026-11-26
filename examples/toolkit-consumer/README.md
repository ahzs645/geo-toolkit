# Standalone toolkit consumer

This small React website imports only the public `@pgmaps/geo-toolkit` package.
It has no PG Maps source aliases, routes, datasets, theme provider, or data-build
steps. All observations and places are fictional. Basemaps use local background
styles so no external map services or credentials are needed.

From the toolkit's root, standalone or as the `packages/geo-toolkit` submodule in PG Maps:

```sh
npm run example         # build the toolkit, then start the example
npm run example:build   # build the toolkit, then type-check and build the example
npm run example:test    # build the toolkit, then run the example's browser tests
```

The scripts run the example by path (`npm --prefix examples/toolkit-consumer run …`), not as an npm
workspace. Inside PG Maps, npm treats PG Maps as the workspace root, so `--workspace @pgmaps/toolkit-consumer`
finds nothing there; by path, the example resolves its packages from whichever root installed them.

The example exercises the reusable Index Lab controller, metric library, weight
editors, method controls and results with an injected local catalog and comparison
universe. Its 0–100 results are normalized to 0–1 for the shared map scale and
legend. It also renders a lossless classified source grid (including missing and
uncertain cells), reusable donuts, map donut markers, category diagrams and
carousel slots. Map workspaces own their mobile feature cards, respond to their
container widths and support theme changes without replacing their map canvases.

The scene-project example uses `SceneStoryRenderer` with a host-owned inline-data
map adapter. Its repository and JSON export transport are injected; switch
between the provided memory and browser-storage adapters to save/load a title,
download the project JSON or import it again. The host validates its own schema
through the shared codec interface. The separate native editorial document uses
`EditorialDocumentRenderer`'s complete default shell with chapters and narrative
actions for category selection, map-view changes and chapter navigation. Its
declared GeoJSON source is provided at `public/example/habitat-grid.geojson`.

The browser tests verify actual MapLibre layer/source state, live score updates,
search preserving the normalization universe, container resizing, theme changes,
mobile card isolation, scene navigation, storage persistence, JSON round trips,
and the editorial renderer's default shell. Build the toolkit before running
them. In an environment with system Chromium, set
`PGMAPS_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium` when running browser tests.

This example belongs to the toolkit repository and links its root package.
The packed-consumer check replaces that link with a tarball and builds outside
this repository. No source imports need to change.
