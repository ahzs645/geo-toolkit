# Geographic toolkit

`@pgmaps/geo-toolkit` is an MIT-licensed toolkit for geographic calculations,
map workspaces, charts, UI, and interactive stories. This public repository is
its source of truth. [PG Maps](https://github.com/ahzs645/PGMaps) uses the toolkit
through host adapters and a pinned Git submodule. The npm package remains private
until a registry release is configured.

## Build and use

From the repository root:

```sh
git clone https://github.com/ahzs645/geo-toolkit.git
cd geo-toolkit
npm ci
npm run build
npm run check
npm run pack:check
npm run example
```

`npm test` runs the independent package tests. Building requires TypeScript and
Tailwind, without PG Maps data,
Vite plugins, a router, scraper submodules, or the PG Maps application.
The output includes ESM, declarations, CSS, native validators and the loader worker.

For development, run `npm run watch` in a second terminal alongside the
host or example dev server. Changes rebuild compiled exports automatically;
failed builds retain the last working output, and successful builds remove
obsolete exports. `npm run watch:check` verifies this recovery path.

```tsx
import { Map, MapFillLayer } from '@pgmaps/geo-toolkit/map'
import { MapSectionLayout, WorkspaceProvider } from '@pgmaps/geo-toolkit/workspace'
import { MapSidebarShell } from '@pgmaps/geo-toolkit/ui'
import '@pgmaps/geo-toolkit/styles.css'

export function EmbeddedMap({ features }) {
  return (
    <div style={{ height: 520 }}>
      <WorkspaceProvider theme="light">
        <MapSectionLayout sidebar={<MapSidebarShell title="Places">Your controls</MapSidebarShell>}>
          <Map center={[0, 0]} zoom={2} theme="light">
            <MapFillLayer data={features} fillColor="#38bdf8" />
          </Map>
        </MapSectionLayout>
      </WorkspaceProvider>
    </div>
  )
}
```

Map tiles remain caller-configurable. Import `stories/styles.css` for editorial
presentations. A workspace supplies scoped theme variables and interaction state;
use one provider per independent map experience. Standalone maps create a private
provider automatically. Host a persistent map above the views that share it.

## Entry points

| Entry | Responsibility |
| --- | --- |
| `/calculations` | Generic scoring, geometry and timeline changes; no React or map engine |
| `/index-lab` | Live Index Lab normalization, weighting, coverage and spatial/derived metric recipes |
| `/index-lab/react` | Configurable metric library, weight controls, ranked results and isolated state/controller |
| `/scales` | Palette sampling, classification, colors and exact serializable legend definitions |
| `/visualizations` | Donut SVG generation independent of a map |
| `/visualizations/react` | Linked timelines, range bands, scatter plots and chart panels |
| `/grids` | Source-pixel decoding, grid classification and optional deck.gl grid rendering |
| `/map` | MapLibre rendering, layers, markers, controls, source ownership and camera helpers |
| `/map/persistent-map` | Optional persistent canvas/provider integration |
| `/map/map-deck` | Optional deck.gl integration |
| `/workspace` | Responsive layout, scoped events, card stacks and media-query hooks |
| `/ui` | Sidebars, legends, dialogs, lists, tooltips, tabs and supporting controls |
| `/projects` | Serializable scene/layer contracts, validated JSON import/export and injectable repositories/share/export ports |
| `/projects/react` | Scene story rendering through supplied layer, map and host adapters |
| `/stories` | Complete native editorial presentation through supplied map/comparison adapters, reusable components and diagrams |

Fine-grained subpaths also support application compatibility imports. These are
provisional; prefer documented entry points in new consumers. Install the optional
React, MapLibre or deck.gl peers when using the corresponding modules.
See [API.md](API.md) for the supported surface, examples, styling and dependency
boundaries, and [RELEASING.md](RELEASING.md) for versioning and release checks.

## Semantics

Calculation normalization and display classification are separate. A resolved
scale and its `createScaleLegend` definition share exact breaks and missing-value
semantics; `ScaleLegend` renders their actual numeric intervals. Zero is valid.
Published source categories and thresholds remain supplied by the host.
Grid types retain original RGBA evidence, uncertain classifications and no-data
cells. Larger display cells do not add measured source detail.

The Index Lab adapter preserves its existing tie, coverage and method behavior;
the generic record scorer is a separate API. They are not silently substituted
for each other. Domain methods and source-specific catalogs remain host-owned.

## Current extraction boundary

PG Maps still owns datasets, specialized formulas, full application navigation,
project catalog normalization, source adapters, storage keys and report formats.
The reusable Index Lab UI receives metric definitions and a compute callback;
its engine does not choose a domain's scoring policy. Editorial and scene
renderers receive map/data adapters instead of fetching PG sources. Memory and
Web Storage repositories implement the generic persistence contract; a host can
supply remote storage, sharing and export transports. Full source-specific
explorer orchestration and a visual project authoring editor remain outside this
package. Raster block transport and router URL integration stay host-owned.

Embedded workspaces use their container width and container placement by default.
The mobile breakpoint is configurable. PG Maps adapters explicitly retain
viewport responsiveness/placement and the legacy navbar/window-event bridge.
Responsive utility styles use CSS `@scope` so nested workspaces remain independent;
use a modern browser with `@scope` support. See API.md for responsive options.

## Development and integration

The package source and tests are at the repository root. The standalone Vite
consumer lives in `examples/toolkit-consumer`; its `/charts` route exercises the
chart toolkit. CI checks source boundaries, unit tests, builds, watch recovery,
browser interactions and a packed consumer outside this repository.

The toolkit's original package history was extracted from PG Maps, preserving
commit authorship. PG Maps pins a commit of this repository at
`packages/geo-toolkit`; commit and push toolkit changes here before updating
that pointer. Its application compatibility tests remain in PG Maps.

To use compiled exports in another app before npm publication, run `npm pack`
and install the resulting tarball in the app. Registry publishing is not enabled.
See [RELEASING.md](RELEASING.md) for the verification and versioning policy.
