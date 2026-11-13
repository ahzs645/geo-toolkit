# Toolkit API guide

`@pgmaps/geo-toolkit` is an ESM TypeScript package. There is no root import:
choose an entry point for the capability you need. PG Maps consumes these same
implementations through local compatibility exports.

## Supported surface

The entry points and named capabilities below are the intended API for new
consumers. Their declarations describe exact callback and data shapes. The
package is currently private at `0.1.0`; this documents the extraction boundary,
not a promise that every historical module is stable.

| Entry point                          | Supported capability                                                                                                                                                                                                                                                                                                                                                                                                           | Additional runtime peers                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `/calculations`                      | `scoreRecords`, `normalizeValues`, coverage, drivers, sensitivity, geographic (`haversineKm`, `greatCircleArc`, `geometryBounds`, `featureCollectionBounds`), timeline and join helpers (`crosswalkResolver`, `groupByJoin`, `groupValue`, `joinDiagnostics`, `canEncodeAsArea`); their configuration/result types                                                                                                             | None                                                           |
| `/index-lab`                         | Index Lab state/results, normalization/coverage and spatial/derived recipes; their types                                                                                                                                                                                                                                                                                                                                       | None                                                           |
| `/index-lab/react`                   | `IndexLab`, `useIndexLabController`, controls, result lists/cards and metric library components                                                                                                                                                                                                                                                                                                                                | React, React DOM                                               |
| `/scales`                            | `resolvePaletteScale`, `samplePalette`, `paletteInterpolator`, `paletteContrast`, color helpers, `createScaleLegend`, `areaRadiusScale`, `cohortRows`; their options and legend types                                                                                                                                                                                                                                          | None                                                           |
| `/visualizations`                    | `renderDonutSvg`, `DonutOptions` (count-sized or fixed `radius`, centre `label`, `emphasizedBand`); `layoutDonutRing`, `assignRing`, `ringSlots`                                                                                                                                                                                                                                                                               | None                                                           |
| `/visualizations/react`              | `TimeSeriesChart`, `LineBandChart`, `ScatterPlot`, `ChartViewport`, `XYPlot`, `SizedChart`, `DonutRingMap`, canvas points and typed series/axis contracts                                                                                                                                                                                                                                                                      | React, React DOM                                               |
| `/grids`                             | `decodePngPixels`, `reconstructImageClassGrid`, `rasterGridCellRing`, grid constants and data types                                                                                                                                                                                                                                                                                                                            | None                                                           |
| `/grids/map-raster-grid`             | `createRasterGridLayer`, `RasterGridPick`                                                                                                                                                                                                                                                                                                                                                                                      | `@deck.gl/core`, `@deck.gl/geo-layers`, `@deck.gl/layers`      |
| `/map`                               | `Map`, markers/popups, `MapDonutMarker`, controls, routes, layer components, `MapStory` composition, camera/scale helpers (`pointBounds`, `fitMapToPoints`), `resizeMap`, `ensureRtlTextPlugin`, settled viewport observation and screen-point clustering, `captureMapImage`, offline `geojsonBasemapStyle`/`graticuleLines` and shared map style constants                                                                    | React, React DOM, MapLibre                                     |
| `/map/persistent-map`                | `PersistentMapProvider`, `PersistentMapHost`, `SharedMap`, `usePersistentMap`, `useMapBasemap`                                                                                                                                                                                                                                                                                                                                 | React, React DOM, MapLibre                                     |
| `/map/map-deck`                      | Shared deck.gl overlay integration                                                                                                                                                                                                                                                                                                                                                                                             | React, React DOM, MapLibre, `@deck.gl/core`, `@deck.gl/mapbox` |
| `/workspace`                         | `WorkspaceProvider`, `MapSectionLayout`, responsive media hooks and `requestMapSearch`                                                                                                                                                                                                                                                                                                                                         | React, React DOM                                               |
| `/ui`                                | Sidebar, list, dialog, feature-card, legend, tab, statistic and control components; `ScaleLegend`; `PlaybackControls`; `MapTimeline`; form and numeric-range fields; clipboard controls/state; floating notifications (`NotificationProvider`, `Notification`, `useNotifications`, `NotificationCard`, `createNotificationStore`); `ScrubNumberField` and its pure `snapScrubValue`/`scrubDragValue`/`parseScrubInput` helpers | React, React DOM                                               |
| `/projects`                          | Scene/layer types, codecs, repositories and JSON import/export/share ports                                                                                                                                                                                                                                                                                                                                                     | None                                                           |
| `/export`                            | `toCsv`, `csvRows`, `csvCell`, `downloadBlob`, `downloadText`; `CsvColumn`, `CsvOptions`                                                                                                                                                                                                                                                                                                                                       | None; downloads need a browser DOM                             |
| `/format`                            | `formatMeasure`, `formatNumber`, `formatPercent`, currency/date/byte/length/area formatters                                                                                                                                                                                                                                                                                                                                    | None                                                           |
| `/stories/model/types`               | Native editorial document types                                                                                                                                                                                                                                                                                                                                                                                                | None; type-only                                                |
| `/stories/model/validate.mjs`        | `parseEditorialDocument`, `validateEditorialDocument`                                                                                                                                                                                                                                                                                                                                                                          | None                                                           |
| `/stories` and `/stories/components` | `EditorialDocumentRenderer`, `SceneStoryRenderer`, editorial components and diagrams                                                                                                                                                                                                                                                                                                                                           | React, React DOM                                               |
| `/styles.css`, `/stories/styles.css` | Compiled, scoped component and editorial CSS                                                                                                                                                                                                                                                                                                                                                                                   | None                                                           |

React and map-engine peers are optional at installation time. Install them when
using a corresponding entry point. Pure calculations, scales, donuts and grid
decoding do not import those peers. Importing `/map` requires a browser-capable
bundler because MapLibre's stylesheet is imported by the module. Deck.gl modules
remain separate from the normal map and pure-grid entry points.

The map modules support MapLibre 5 (from 5.15) and 6. They import MapLibre
through namespace and named imports only, since MapLibre 6 has no default
export. CI typechecks, tests and builds against both majors; to check MapLibre 6
locally, run `npm install --no-save maplibre-gl@^6.0.0`, then `npm run check`,
`npm test` and `npm run build`, and restore with `npm ci`.

Other wildcard subpaths exist so PG Maps' old file paths can reexport the moved
implementations. They are **compatibility surfaces**, not additional supported
APIs. In particular, loader internals/workers, source-ordering helpers, mobile
card stores, raw workspace event dispatch, SVG wedge builders and MapLibre donut
property adapters may change with their containing implementation. Export
presence alone does not make those modules part of the documented API. Prefer
the entry points above; do not import `dist` files or package `src` paths.

## Calculate, then resolve display semantics

`buildBasemapStyle` and `BasemapAppearance`, exported from `/map` and
`/map/map-styles`, apply explicit colors/visibility to a copy of a supplied
Carto/OpenMapTiles style. They preserve sources, filters and zoom constraints.
The host provides tile transport and named presets.

Calculation normalization determines scores. Display classification determines
which colors represent scores. Persist those configurations separately so a
palette update cannot change a calculation.

```ts
import { scoreRecords, type ScoreRecord } from '@pgmaps/geo-toolkit/calculations'
import { createScaleLegend, resolvePaletteScale } from '@pgmaps/geo-toolkit/scales'
import { renderDonutSvg } from '@pgmaps/geo-toolkit/visualizations'
import { GRID_UNCERTAIN, reconstructImageClassGrid } from '@pgmaps/geo-toolkit/grids'

type Metric = 'access'
const records: ScoreRecord<Metric>[] = [
  { id: 'north', values: { access: 25 } },
  { id: 'south', values: { access: 75 } },
]
const results = scoreRecords(records, {
  metrics: [{ key: 'access', weight: 1, normalization: { method: 'minMax', min: 0, max: 100 } }],
  aggregation: { method: 'additive' },
})
const scale = resolvePaletteScale({
  colors: ['#eff6ff', '#1d4ed8'],
  domain: [0, 1],
  classes: 3,
  classification: 'manual',
  breaks: [0.2, 0.8],
  missingColor: '#94a3b8',
})
const legend = createScaleLegend(scale, { title: 'Access index', unit: '0–1' })
const rows = results.map((result) => ({ id: result.record.id, fill: scale.colorForValue(result.score) }))
const donut = renderDonutSvg({ counts: [2, 3, 5], colors: scale.colors, showCount: true })
const grid = reconstructImageClassGrid(
  new Uint8ClampedArray([255, 0, 0, 255]),
  1,
  1,
  [{ value: 1, rgb: [255, 0, 0] }],
  { cellPixels: 1, preserveSourcePixels: true },
)
const uncertain = grid.cells[0].value === GRID_UNCERTAIN
// legend is serializable; resolver functions are intentionally not saved.
export { results, scale, legend, rows, donut, grid, uncertain }
```

The generic scorer returns scores in `[0, 1]`. Index Lab's policy returns scores
in `[0, 100]` and deliberately preserves its historical normalization, tie and
coverage behavior. Choose an engine explicitly; they are not interchangeable.
Hosts supply metric catalogs, data availability, domain methods, units and
storage. A value filled with zero cannot prove that its source had coverage.

### Index Lab interface and state

The pure `/index-lab` entry exports `IndexLabMetric`, `IndexLabRecord`,
`IndexLabSettings`, `IndexLabState`, `createIndexLabState`, `indexLabReducer` and
`computeIndexLabResults`. Low-level `calculateIndexRows`, normalization/coverage
helpers, `computePointMetricRecipe` and `computeDerivedExpressionMetric` support
custom pipelines. Spatial recipes accept caller-supplied records and boundaries;
the package does not discover or fetch a geographic catalog.

`/index-lab/react` supplies the complete standard interface and its parts.
Provide a metric catalog and records to `IndexLab`; defaults are percentile
normalization, additive aggregation and neutral missing data. Provide explicit
coverage flags when a finite placeholder value does not represent a measurement.

```tsx
import type { IndexLabMetric, IndexLabRecord } from '@pgmaps/geo-toolkit/index-lab'
import { IndexLab } from '@pgmaps/geo-toolkit/index-lab/react'
import { WorkspaceProvider } from '@pgmaps/geo-toolkit/workspace'
import '@pgmaps/geo-toolkit/styles.css'

const metrics: IndexLabMetric<'access'>[] = [
  {
    key: 'access',
    label: 'Access',
    shortLabel: 'Access',
    description: 'Measured service access',
    category: 'services',
    format: 'number',
    defaultWeight: 1,
  },
]
const records: IndexLabRecord<'access'>[] = [
  { id: 'north', label: 'North', values: { access: 25 }, coverage: { access: true } },
  { id: 'south', label: 'South', values: { access: 75 }, coverage: { access: true } },
]

export function AccessLab() {
  return (
    <WorkspaceProvider theme="light">
      <IndexLab metrics={metrics} records={records} />
    </WorkspaceProvider>
  )
}
```

Use `useIndexLabController` plus `IndexLabControls`/`IndexLabResults` for a
custom layout. Its `compute` callback receives weights and settings; querying
and selecting results never redefine the normalization universe. Specialized
domain methods supply a custom callback and method controls. Initial props
apply on mount; use `replaceState` for an explicit reset or loading a saved
configuration. Updated catalogs change available metrics without silently
discarding the user's existing weight state. Hosts own URL/history/storage
adapters and source availability messages.

Controls use a stacked layout by default for narrow panels; compose
`IndexLabControls` with `layout="columns"` for wider views. Sparse absent
weights are zero. The calculation engine rejects nonfinite supplied weights;
the controller ignores invalid edits and sanitizes its initial state. A
negative weight expresses preference for lower metric values.

### Numeric scales and legends

`PaletteSampling` controls authored colors, unequal source positions, palette
`range` within `[0, 1]`, reversal and RGB/Lab interpolation. `PaletteScaleOptions`
adds numeric `domain`, requested `classes`, classification and `missingColor`.
`ResolvedPaletteScale` describes the shared renderer/legend result.
Palette ranges never crop the numeric domain.

- Equal intervals divide the supplied domain. Manual `breaks` must increase
  strictly inside it and determine the effective class count.
- Quantiles use finite observations inside the domain, deduplicate thresholds,
  and can produce fewer classes than requested. Constant domains have one bin.
- Exact break values enter the upper bin. Finite out-of-domain values clamp to
  the end colors. `null`, `undefined`, `NaN` and infinities are missing; zero is
  a valid observation.
- Use the same resolved scale for marks and `createScaleLegend`. The legend
  snapshots exact breaks, colors, unequal numeric bin widths and missing-data
  treatment. `ScaleLegend` accepts it with an optional `formatValue` callback.
- Keep comparison domains/breaks fixed across dates. Hosts retain published
  category identities, thresholds and semantic colors; no global palette
  substitution or automatic theme inversion is applied.

Categorical data can use explicit color registries and `colorForKey` for stable
fallback colors. Generic numeric classification should not be used to invent
new category thresholds.

### Proportional symbols and joins

`areaRadiusScale(values, { maxRadius, minRadius })` returns `{ maximum, radius }`
where circle area is proportional to the absolute value: `radius(maximum)` is
`maxRadius`, zero and missing values get no circle, and `minRadius` only lifts
nonzero values (it distorts area below that size). Compute `values` from a
comparison cohort, not from the filtered rows: `cohortRows(all, shown,
scopeFields)` keeps every row sharing a scope (for example a period and measure
definition) with a shown row, so hiding comparators never enlarges what remains.

Join helpers keep geographic aggregation explicit. Hosts keep their own
crosswalk data and decide which metrics are additive.

- `crosswalkResolver({ links, native })` resolves a source key through reviewed
  links, then native codes; blank or unknown keys are unmatched (`null`).
- `groupByJoin(rows, joinOf)` groups rows by code in first-seen order.
- `groupValue(values, { allowsSum })` shows a single finite value, sums several
  only when `allowsSum`, and withholds (`null`) when any input is missing or
  nonfinite.
- `joinDiagnostics(rows, { joinOf, valueOf, available, allowsSum })` counts
  matched, missing, unmatched (no code, or absent from loaded geometry) and
  ambiguous (shared code without `allowsSum`) rows.
- `canEncodeAsArea(values)` is false when any value is negative; circle area
  cannot show a signed change.

### Donuts and grids

`renderDonutSvg` returns `{ svg, size, total }` without a DOM. Provide
nonnegative category counts in the same order as `colors`. Omitted category
counts are zero. `total` can preserve a known aggregate; otherwise counts are
summed. It controls the historical count-based marker sizing. `showCount` and
`centerStyle: 'white' | 'transparent'` preserve the original presentation.
`centerColor`, `textColor`, `textHaloColor` and `shadow` allow host styling while
leaving category colors unchanged. The default colors and shadow reproduce
existing markers. SVG attributes are escaped; this is a small donut renderer,
not an arbitrary SVG sanitization or rich-content API.

For a marker whose size or centre text encodes something other than a count,
pass `radius` (outer px), optional `innerRatio`, `label` and `fontSize`; the
wedges always divide the drawn bands, so fractional values (concentrations)
close the ring. `emphasizedBand` fades the other bands to `fadedOpacity` for
legend hover, and `title` adds an accessible name. `MapDonutMarker` pins the
same SVG to a coordinate; put a `MarkerLabel` in `content` (inside the marker
element) and `MarkerTooltip`/`MarkerPopup` in `children`.

`GRID_NO_DATA` means transparent source evidence; `GRID_UNCERTAIN` means the
classification was ambiguous or outside its thresholds. `cellPixels` describes
globally aligned source-pixel boxes, not a new measurement resolution. Lossless
`rgba` evidence is retained only with `cellPixels: 1` and
`preserveSourcePixels: true`. Larger boxes use the documented agreement rules.
`decodePngPixels` accepts 8-bit RGBA PNGs and checks CRCs.

The optional `createRasterGridLayer` accepts `RasterGridLayerOptions` with a `tileUrl` callback, source zoom
bounds, palette and `colorForValue`, with optional hover/pick/error callbacks.
It fetches 256×256 XYZ source tiles and retains tile/cell metadata when picked.
Preserved source RGBA takes precedence over restyling; disable source-pixel
preservation explicitly when classification colors should be rendered. Styling
or zooming never creates additional source detail.

## Embed a responsive workspace

### Interface motion and selection framing

`/ui` exports `MOTION_DURATION`, `MOTION_EASING`, `useReducedMotion`, and
`useMotionPresence`. Programmatic sheet/panel changes use 350 ms; small feedback
uses 150 ms. Direct pointer movement has no easing. Presence keeps closing
content mounted while its transition finishes and cancels stale work when
reopened; callers must make closed content inert immediately. Reduced-motion
presentation reaches the same final state without spatial travel or an exit
delay. Import the stylesheet for the actual animations; no animation plugin is
required.

`useFlyToSelection` (`/map`) accepts `mode: 'fly' | 'ease'`, extra `padding`,
and `keepVisible` (default true), in addition to target, zoom, duration, and
`focusKey`. Its default duration is now 350 ms. It frames selections in the
visible part of the owning workspace, accounting for mobile controls and
feature cards without leaving persistent MapLibre padding behind. Discrete
sheet targets start one native camera movement; direct panel manipulation
defers reframing until release. User map gestures stop following until a new
selection or `focusKey` requests it again. Desktop layout resizes are batched
into a settled correction rather than restarting a flight on each frame.

Controls and feature-card handles support pointer/touch dragging, velocity
settling, interruption at the current rendered position, and keyboard detents.
A touch on a sheet's or card's body drags it too: below the full detent any
vertical swipe moves it, and at full a downward swipe moves it once its content
is scrolled to the top, so the content scrolls otherwise. Taps, horizontal
swipes and form fields stay with the content. A collapsed card shows its body
as soon as it is dragged open. Hidden bodies are inert; exposed stack controls
remain operable. Desktop
sidebars retain their state while hidden. `MapSectionLayout.bottomPane` retains
its last content only through a desktop closing transition; set
`bottomPaneResizing` during direct divider dragging to avoid eased resizing.

### Mobile sheet stack

On phones, `MapSectionLayout`'s controls sheet and every `MobileFeatureCard` in
the same workspace form one stack, like Felt's stacked sheets. The workspace's
sheet store holds the order; nothing else decides which sheet is in front.

How a stack looks:

- The front card is interactive at its own detent (compact, full or collapsed).
- Each card behind it is drawn at the front card's height, raised 10 px per
  step (`MOBILE_CARD_STACK_PEEK`), inset 8 px per step and a shade darker. Its
  body is inert; only its top strip shows.
- Cards three or more steps back are hidden
  (`MOBILE_CARD_STACK_MAX_VISIBLE_DEPTH`).
- The controls sheet is the rearmost strip. Tapping it brings it to the front,
  and the front card docks behind it at the controls' height.

Swapping: tapping any visible part of a rear sheet brings it to the front. It
opens at its own detent, and the previous front card lines up behind it.

Dismissing: the map stays usable beside a sheet at its compact detent. Above
it, the controls sheet dims the map, fully at the full detent, and tapping the
dimmed map dismisses the sheet: with a card docked behind the controls, that
card comes back to the front; otherwise the controls collapse to their peek.
Tapping the map beside a front card closes the card (`closeOnBlankMapClick`).

#### Add a sheet

1. Render a `MobileFeatureCard` inside the layout's workspace, usually through
   `ResponsiveFeatureDetail` so desktop gets the popup instead:

   ```tsx
   <ResponsiveFeatureDetail
     popup={<MapPopup …>{details}</MapPopup>}
     card={
       <MobileFeatureCard
         stackId="parcel"
         title={parcel.name}
         subtitle="Parcels"
         cardKey={parcel.id}
         onClose={() => setParcel(null)}
       >
         {details}
       </MobileFeatureCard>
     }
   />
   ```

2. Pick `stackId` by identity, not by content. Cards with the same `stackId` are
   one sheet: selecting another parcel updates the `parcel` sheet in place.
   Different ids stack, e.g. a parcel card in front of the feature table. The
   default is `feature`.

3. Signal new content so the sheet comes forward, as Felt does on a new
   selection:
   - `cardKey`: a new selection. The card comes to the front and resets to its
     compact detent.
   - `focusKey`: the same sheet, asked for again (e.g. a table switched to
     another layer from the controls). The card comes to the front and keeps its
     detent.

4. Size it with `height` (the full detent) and `initialVisibleHeight` (the
   compact one). Cards behind the front card follow the front card's height
   whatever their own sizes.

Do not build a separate fixed bottom sheet for map content: it would sit outside
the stack and cover or be covered by the others unpredictably. Modal dialogs
(`DialogContent variant="sheet"`) are a separate, blocking layer and are fine.

#### Test a stack

Each card panel has `data-map-feature-card-panel="true"` and
`data-stack-role`: `primary` (front), `secondary` (behind another card) or
`docked` (behind the controls sheet). A docked card is `aria-hidden`, so find
cards by panel and header text rather than by role, and tap the top strip of a
rear card to swap it:

```ts
const card = (name: string) =>
  page
    .locator('[data-map-feature-card-panel="true"]')
    .filter({ has: page.locator(':scope > header').getByText(name, { exact: true }) })
const box = (await card('Parcel 12').boundingBox())!
await page.touchscreen.tap(box.x + box.width / 2, box.y + 4)
await expect(card('Parcel 12')).toHaveAttribute('data-stack-role', 'primary')
```

The rear card follows the front card's reported height a frame later, so poll
geometry assertions instead of reading once.

These are observable behavior changes at the existing private 0.1.0 extraction
boundary; no registry release or new peer dependency is introduced.

On desktop, `bottomPane` covers the bottom of the map area the way Felt's data
table covers its map, instead of shrinking the map. The main `Map` (one that
fills the content area to its bottom edge) extends its canvas under the pane by
the pane's animated height, so the canvas never changes size while the pane
opens, closes, expands to full screen or is dragged, and the picture stays
still. Map controls and children stay in the visible part above the pane. The
pane's settled height is added to the map's persistent bottom padding, so
`getCenter`, `flyTo`, `easeTo`, `fitBounds` and `useFlyToSelection` frame the
visible area; `onMoveEnd` bounds and `readMapViewport` exclude the covered
strip. A bottom padding the host sets itself is preserved.

Maps that still resize (sidebar transitions, window resizes, persistent map
hosts) are redrawn in the same frame. Changing a canvas's size clears its WebGL
buffer, and a bare `map.resize()` only paints on the next animation frame, which
shows as a blank flash. Hosts that own a raw MapLibre map should call
`resizeMap(map)` from `/map` in their `ResizeObserver` callback instead of
`map.resize()`; do not defer it to `requestAnimationFrame`.

`DialogShell` starts its visual close immediately, then invokes `onClose` and
`onOpenChange(false)` after exit (immediately with reduced motion). Opening
`onOpenChange(true)` remains immediate. Controlled reopening cancels pending
closure. `RecordDialog`'s footer uses the same close lifecycle. Keep this callback
timing in mind when a host conditionally mounts dialogs.

When filtering removes the keyboard-focused item in `VirtualResultList`, it
cancels the previous keyboard scroll target and resets the results viewport to
the top. An older virtualizer reconciliation cannot scroll the filtered list
back to the former end. Retained focused items preserve their position.

`revealKey` scrolls that row into view when the key changes, measuring it first
so a row that grew to show its detail ends up fully visible. Render a selection's
detail under its row in `children`, not above the list: rows are re-measured, and
the clicked row stays where it is. `ResultRowDetail` continues the row's selected
tint and left bar under it, so the two read as one item. The default
`accent="theme"` reads the `selected` tokens, so a host theme recolours it; a named
palette (`sky`, `teal`, `green`, …) stays that colour whatever the theme. Scrolling to a row allows for a sticky
`ListHeader` placed directly above the list.

Import the toolkit stylesheet once. Give the workspace a definite height and
one provider per independent map experience. Supply initial camera coordinates
and your tile styles; the toolkit does not infer an application's region.

```tsx
import type { FeatureCollection, Geometry } from 'geojson'
import { Map, MapFillLayer } from '@pgmaps/geo-toolkit/map'
import { MapSectionLayout, WorkspaceProvider } from '@pgmaps/geo-toolkit/workspace'
import { MapSidebarShell, ScaleLegend } from '@pgmaps/geo-toolkit/ui'
import { createScaleLegend, resolvePaletteScale } from '@pgmaps/geo-toolkit/scales'
import '@pgmaps/geo-toolkit/styles.css'

const scale = resolvePaletteScale({
  colors: ['#eff6ff', '#1d4ed8'],
  domain: [0, 100],
  classes: 5,
  missingColor: '#94a3b8',
})
const legend = createScaleLegend(scale, { title: 'Access', unit: '%' })

export function EmbeddedMap({ features }: { features: FeatureCollection<Geometry> }) {
  return (
    <div style={{ height: 520 }}>
      <WorkspaceProvider theme="light" className="my-map">
        <MapSectionLayout
          sidebar={
            <MapSidebarShell title="Places">
              <ScaleLegend legend={legend} />
            </MapSidebarShell>
          }
        >
          <Map center={[0, 0]} zoom={2} theme="light">
            <MapFillLayer data={features} fillColor="#38bdf8" />
          </Map>
        </MapSectionLayout>
      </WorkspaceProvider>
    </div>
  )
}
```

The example uses a constant polygon fill to keep its layer input minimal. For a
classified view, supply the layer's property expression or per-feature color
from the same scale used for its legend. The host owns data loading and units.

A choropleth whose values change (a story step, a filter, a year) should keep
its shapes and change only its values. Every new `data` object is copied to
MapLibre's worker and re-tiled; for detailed boundaries that is megabytes of
work, and it lands just as the camera starts to move. Keep `data` the same
object, or pass the file's URL so the worker fetches it itself, and give the
values as `featureState`, keyed by `idProperty`:

```tsx
<MapFillLayer
  data={boundariesUrl}
  idProperty="code"
  featureState={valuesByCode} // { [code]: { value: 12.5, focused: true } }
  fillColor={['interpolate', ['linear'], ['coalesce', ['feature-state', 'value'], 0], 0, '#eff6ff', 100, '#1d4ed8']}
/>
```

Only features whose values changed are updated, and keys that are no longer
given are cleared. Feature state can drive paint, not filters or layout, so show
an outline by opacity rather than by filtering it in. `syncFeatureState` applies
the same update to a source a host manages itself.

`Map` accepts MapLibre options other than `container`, `style` and `trackResize`,
plus toolkit `styles`, `theme`, loading, controls and viewport props. `center`
and `zoom` establish the initial camera. Supply both `viewport` and
`onViewportChange` for controlled camera state. Default basemaps are Carto
light/dark URLs; custom `styles` can be URLs or MapLibre style specifications.
Use `controls={null}` for a bare canvas or supply custom controls. Map children
can access the instance and load status through `useMap`.

`MapSectionLayout` owns sidebar/bottom-panel layout and sheet interaction.
`WorkspaceProvider` owns event scope, card stack, theme and bounds. Container
placement is the embedding default; choose `placement="viewport"` only for a
full-page experience. Share a provider only when the maps are intentionally
part of the same interaction workspace. The persistent-map entry point retains
one canvas above changing views; its lifetime is a host architecture decision.

Responsive presentation defaults to `responsive="container"`: workspace width
below `breakpoint` (768 pixels by default) uses mobile sheets, even on a wide
desktop page. `responsive="viewport"` retains page-wide breakpoint behavior.
Placement and responsiveness are independent controls. `toolbar` accepts an
explicit host toolbar element; `rootElement` supports host-owned sibling
content. Routine embedded maps should let the provider measure its own root.
Dialog portals inherit workspace theme/bounds; `onDialogOpenChange` lets the
host coordinate its own chrome without the toolkit searching the document. It
(and `DialogContent`'s `onOpenEffect`) reports `false` when the close starts,
not after the exit animation, so hidden chrome returns while the dialog fades
and is there for focus to return to; a reopen during the exit reports `true`.
Editorial and scene reading layouts follow the nearest provider's responsive
mode too. Their existing story-specific thresholds remain independent of the
configurable sheet breakpoint; a nested viewport workspace keeps page-wide
reading layouts inside a container-responsive parent.

Typed layers use `MapStyleValue<T>` for literals or MapLibre expressions,
`MapFeatureId` for string/numeric selection IDs and `MapFeatureClickHandler` for
typed selection callbacks. `selectedIds` accepts readonly lists; `filter={null}`
clears a layer filter. Focused supported layer subpaths under `/map/layers/`
are `fill`, `circle`, `line`, `geojson`, `canvas`, `raster`, `heatmap`, `pie-cluster` and `pmtiles-fill`.
Use `PieClusterPointProperties` to describe category counts in point GeoJSON.
`MapCircleLayer` accepts `hoverEnabled={false}` to dismiss hover cards during
external interactions such as marker dragging; cards also dismiss while the
map moves or a pointer button is held.

## Theme and styling

Component CSS is scoped to `.geo-toolkit`; consumers do not need PG Maps'
Tailwind configuration. `WorkspaceProvider` adds that class and its explicit
`data-theme`. Override CSS variables on the provider using `className` plus CSS
loaded after the toolkit stylesheet, or using its `style` prop.

```css
.geo-toolkit.my-map {
  --primary: 215 80% 35%;
  --primary-foreground: 0 0% 100%;
  --ring: 215 80% 35%;
  --radius: 0.75rem;
}
.geo-toolkit.my-map[data-theme='dark'] {
  --primary: 215 80% 70%;
  --primary-foreground: 215 50% 10%;
}
```

Theme color variables use **space-separated HSL channels**, not complete
`hsl(...)` strings. Supported UI roles are `--background`, `--foreground`,
`--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`,
`--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`,
`--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`,
`--destructive-foreground`, `--border`, `--input`, `--ring` and `--radius`.
Chart roles `--chart-1` through `--chart-5` are theme presentation colors and
must not serve as stable category identities.

Status colours `warning`, `danger`, `success` and `info` each have four roles:
`--warning` for text and icons on the page background, and
`--warning-foreground`, `--warning-surface` and `--warning-border` for the text,
fill and edge of a tinted box. `InlineAlert`, `MapLegendNote`, notifications,
status `Badge` tones, `StatGroup` and `TextButton tone="danger"` read them.
`--destructive` stays the fill of a destructive action button.

UI-state tokens let a host theme recolour what used to be fixed sky and
slate: `--selected`, `--selected-border` and `--selected-focus` are a selected
result row's fill, edge and focus ring (`ResultRow` and `ResultRowDetail` with
the default `accent="theme"`), with `--selected-alpha` as the fill's opacity
(1 in light, 0.3 in dark, so the dark tint shows the surface under it);
`--link` and `--link-hover` colour `TextButton tone="accent"`; and
`--map-surround` is the band `MapSectionLayout` shows round its map. Their
defaults are Tailwind's sky and slate, the colours these parts had before.

Every corner derives from `--radius`: `rounded-sm` and `rounded` are 4 px less,
`rounded-md` 2 px less, `rounded-lg` equal, `rounded-xl` and `rounded-2xl` 4 and
8 px more. `rounded-full` stays a pill. Setting `--radius: 0` squares them all.

A host using Tailwind extends the same token names from
`@pgmaps/geo-toolkit/tailwind-theme.mjs`, so its markup and the package's agree:

```js
import { toolkitTheme, touchVariant } from '@pgmaps/geo-toolkit/tailwind-theme.mjs'

export default {
  theme: { extend: toolkitTheme },
  plugins: [touchVariant],
}
```

`Button` sizes `xs` (28 px), `2xs` (24 px), `icon-xs` and `icon-2xs` give dense
tool panels their controls without height overrides; `field` (32 px) matches a
dense form field, for a button that shares a row with one.

Responsive and dark variants use CSS `@scope` to stop at nested workspace
boundaries. Plan for Chromium/Edge 118+, Firefox 146+, and Safari/iOS Safari
26.4+ for that feature. Safari 17.4–18.x also implements it, but Safari
26.0–26.3 has an input/textarea styling regression. These are CSS feature
requirements, not a claim that every browser version has been tested. See
[MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/scope.json).

Map fill/outline colors and donuts are controlled by data/props, independently
of UI tokens. Changing the UI theme does not automatically replace a palette.
Keep reviewed light/dark palette variants under host control. Editorial stories
use their own scoped `--editorial-*` roles and stylesheet; see
[story integration](src/stories/README.md).

## Project and story boundaries

The project entry point exports structural scene/layer types plus reusable
codec/repository interfaces and adapters. `createProjectCodec` takes a host
parser, ID function and optional transport preparation function.
`parseProjectJson` and `exportProjectJson` validate both imported content and
exported transport forms. `createMemoryProjectRepository` supplies an in-memory
adapter; `createWebStorageProjectRepository` accepts a host storage port and
explicit key. Repository `list/get/save/remove` operations are asynchronous and
accept optional cancellation. The synchronous `createProjectCollectionStore`
adapter supports apps with existing synchronous lists.

`importProjectFile` accepts any object with an asynchronous `text()` method.
`exportProject` and `shareProject` require host-provided export/share ports;
there is no default upload endpoint. `downloadProjectJson` is an opt-in browser
download adapter. Parsers, catalog normalization, storage namespaces, retention
limits and network authentication remain host configuration.

Native editorial JSON can be validated outside React using
`/stories/model/validate.mjs`.
`parseEditorialDocument` throws for invalid content;
`validateEditorialDocument` returns `string[]` errors (empty means valid).

`EditorialDocumentRenderer` provides native editorial content, actions,
category selection, tours and chapter presentation around host-supplied
`renderMap`, optional comparison and shell adapters. `SceneStoryRenderer`
provides scene reading layouts with a host `renderMap` callback and optional
chrome. Both keep data transports outside the renderer. The host retains its
tile policies, loading, selection details, catalog and URL/storage integration.
Supply stable map nodes instead of recreating the map instance at every step.

Starting a map is GPU set-up (a WebGL context, its canvas and shaders) that
blocks the page for tens to hundreds of milliseconds, and a map that resizes
draws a blank frame. Network loading is rarely the cost once the style, tiles
and boundaries are cached. So, for a reader that moves between map views:

- Change values, focus and camera on one map rather than replacing it (see
  `featureState` above).
- Keep a view mounted once it has been shown, and when a different kind of view
  takes over, hide it at full size (`visibility: hidden`, absolutely positioned
  underneath) rather than unmounting it or using `display: none`. The same holds
  for tabs that switch between maps.
- Start the views a step will need before it is reached, one per idle moment
  (`requestIdleCallback`), after the current step's camera move has finished,
  nearest step first.
- Do not animate a map container's size. Move surrounding chrome by scrolling
  or transforming it so the map keeps its size.
- In a swipe comparison, raise the hover card above the clipped map and show
  both sides' values, since the pointer may be over either.

`/stories/storyScene`, `/stories/sceneController` and
`/stories/diagrams/storyDiagrams` are supported pure helper entry points for
camera fitting, category/legend resolution, scene-state transitions and diagram
layout. `/stories` also exports their functions for React consumers. The
current extraction provides validated JSON authoring and reusable rendering;
a visual project editor remains a separate capability. ArcGIS source-graph
adapters and PG Maps' full catalog orchestration stay host-owned.

## Exports and display formatting

`/export` serializes tables and saves files. `toCsv(columns, rows, options)`
writes a header and one line per record; a string column reads that field (or
array position), and `{ header, key }` or `{ header, value(row, index) }`
relabels or derives a cell. `csvRows` writes rows as given for report layouts
with blank or ragged lines. Every cell is quoted and lines end in CRLF unless
`quote: 'needed'`, `delimiter` or `newline` say otherwise. `guardFormulas`
(default on) prefixes text a spreadsheet would run as a formula with `'`;
numbers and numeric text such as `-122.7` are left alone. `bom: true` prepends
a UTF-8 byte order mark for Excel. `downloadBlob` and `downloadText` save
through a temporary link and release the object URL after
`DOWNLOAD_URL_LIFETIME_MS`, because WebKit cancels downloads whose URL is
revoked synchronously. Hosts choose filenames, MIME types and which fields leave
the application.

```ts
import { downloadText, toCsv } from '@pgmaps/geo-toolkit/export'

const csv = toCsv(['id', { header: 'Population', key: 'population' }], rows, { bom: true })
downloadText(csv, 'regions.csv', 'text/csv;charset=utf-8')
```

`/format` pins `DEFAULT_LOCALE` (`en-CA`) so output does not change with the
viewer's browser settings; the toolkit's own counts and default chart labels use
it too. Formatters take a `fallback` for missing values where they have one. `formatMeasure(value,
unit, options)` attaches `%`/`percent` without a space, formats `CAD`/`$` as
Canadian dollars, and places any other unit after a space, rounding to one
decimal unless `Intl.NumberFormatOptions` say otherwise. Hosts own unit
vocabulary, such as which units are bare counts.

## Versions and reuse

During local development, run `npm run toolkit:watch` from the host repository
alongside its dev server. The watch build updates package exports without
discarding the previous working build on a compilation failure; it does not
run PG Maps' dataset preparation. `npm run toolkit:watch:check` exercises that
recovery path. `npm run toolkit:pack:check` verifies the actual distributable
artifact, including pure entry-point imports and its dependency boundaries.

Pin a package version or reviewed artifact, build against its declarations and
exercise the standalone consumer before updating a production site. During
`0.x`, a minor release may change the supported API; patch releases should
preserve it. Keep host adapters at compatibility boundaries. Review changes to
calculation semantics, published thresholds and saved project formats explicitly
even when a TypeScript build succeeds. Other websites receive improvements when
they upgrade their dependency and rebuild.

The package carries the repository's existing MIT license with its contributor
notice. Dataset, tile-provider, imagery and third-party dependency licenses
remain those of their respective sources; package licensing does not grant
rights to external data.

## Charts and dashboard controls

Import charts from `/visualizations/react`; the pure `/visualizations` entry
still loads without React. Import `DashboardToolbar`, `RangeControls`,
`SeriesLegend`, `SelectedSeriesList` and `FullscreenPanel` from `/ui`, and include
`/styles.css`. The host chooses layout and supplies its theme variables.

- `TimeSeriesChart` takes sorted wide rows `{ x, [seriesId]: number | null }`,
  descriptors `{ id, label, color }`, a controlled numeric `range` and `onRange`.
  Dragging or brushing emits `[min, max]`; selecting the whole navigator emits
  `null`. Hosts filter downstream inputs and exports using that range.
- `LineBandChart` takes series with sorted points `{ x, y, range? }`.
  `y: null` leaves a gap; optional `range: [low, high]` supplies the drawn band.
  The component never calculates means or interprets a band as uncertainty.
  Opt into `highlightOnHover` to emphasize the nearest line, dim the others and
  show only that line's original point in the tooltip. Null gaps are not bridged.
- `TimeSeriesChart` accepts an optional numeric `yDomain`; hosts can supply a
  baseline and rounded bounds with matching `yAxis.ticks`. Its Y label is vertical.
  `showPoints` adds colored markers to the plot and navigator for sparse or
  aggregated observations. Tooltips retain each descriptor's label and units.
  Chart tooltip cards wrap long content and stay within the measured chart slot.
- `ScatterPlot` takes colored point arrays `{ x, y, ...metadata }`.
  It draws all visible finite points on one high-DPI canvas; a nearest-point
  tooltip receives the original typed point. Radius, opacity, hit radius and
  an optional identity line are configurable.
- XY charts take finite, increasing `extent: [xmin, xmax, ymin, ymax]`, accessible
  `label`, numeric axis formatters/labels, configurable `yAxis.width` and a height. They keep zoom locally
  unless `zoom` / `onZoom` control it. Drag selects a rectangle, `+` zooms and
  `Home` resets. Zoom and fullscreen preserve the mounted chart instance.
- `ChartViewport` reports the available height of a host-styled slot, committed
  before paint, so a sibling opening or folding beside the chart never leaves it
  drawn at the old height; `SizedChart` observes width. For custom renderers, `XYPlot` and canvas points
  accept plot insets, including axis sizes, to align pointer and draw coordinates.
- `captureChartSvg(element, { title?, subtitle?, series? })` resolves theme CSS
  and captures SVG plots/axes and canvas observations in a standalone SVG Blob,
  with its pixel width/height. Canvas points are embedded as PNG; controls and
  HTML hover cards are excluded. `rasterizeChart(snapshot, mimeType, scale?)`
  returns PNG/JPEG (default scale 2). Hosts own filenames, downloads and PDF
  packaging. These are browser-only helpers in `/visualizations/react`.
- `FullscreenPanel` accepts opt-in `menuActions` (`id`, `label`, `disabled?`,
  async `onSelect(panelElement)`) and `help` for a compact options/help dialog.
  Action errors and progress remain in the dialog; closing it preserves
  fullscreen/zoom and returns focus to its trigger. `loading` shows a nonblocking
  spinner and marks the panel busy. No export formats or data policy are assumed.
  `dialogOptions` can inject a standalone host's theme and `onOpenEffect` chrome
  integration; otherwise the nearest workspace supplies them.
- `RangeControls` accepts two controlled string fields (date, number, time or
  datetime), field constraints, preset descriptors and reset/onChange callbacks.
  Hosts validate edits and calculate presets; no default date or domain policy
  is embedded in the component.
- `SeriesLegend` and `SelectedSeriesList` accept `{ id, label, color, visible,
detail? }` and controlled toggle/remove callbacks. The host owns color slots
  and selection limits. `DashboardToolbar` uses its own container width to
  switch between a single row and wrapped controls (`inlineAt`, default 1000px).

Numeric x can represent UTC timestamps, elapsed hours or another ordered measure.
Zero and negative values remain observations; nulls remain gaps. `numericExtent`
ignores missing/nonfinite values and pads constant domains. Pass complete inputs
for the timeline navigator; supply independently filtered inputs for other plots.
There is no implicit global coordination, fetching, aggregation or CSV transport.

```tsx
import { LineBandChart } from '@pgmaps/geo-toolkit/visualizations/react'
;<LineBandChart
  label="Energy output envelope"
  height={280}
  extent={[0, 24, -5, 15]}
  xAxis={{ format: (hour) => `${hour} h` }}
  yAxis={{ label: 'kWh' }}
  series={[
    {
      id: 'solar',
      label: 'Solar',
      color: '#d97706',
      points: [
        { x: 0, y: 0, range: [-1, 1] },
        { x: 12, y: 10, range: [8, 12] },
      ],
    },
  ]}
/>
```

`examples/toolkit-consumer/src/ChartExperience.tsx` demonstrates the full API with
non-water data. Its `/charts` browser suite verifies linked ranges, a missing
line segment, zero-point tooltip metadata, stable colors, canvas rendering,
fullscreen/zoom preservation, container resizing and independent workspace state.

## Clicks, draw order and host-painted rasters

`onFeatureClick` on `MapFillLayer`, `MapCircleLayer` and `MapLineLayer`
receives the feature id, a `MapFeatureClickEvent` (modifier keys plus the
clicked `lngLat`, null for synthetic clicks) and the feature's properties. For a
plain HTML popup at the click, pass `clickHtml` instead; it mirrors `hoverHtml`
and, like it, inserts the returned string as HTML, so escape interpolated data
(`escapeHtml` or `mapTooltipHtml` from `/ui`).

`layerOrder` places a layer's group among the other ordered layers (higher draws
on top) whatever order their data arrives in. Fill, circle, line, raster,
heatmap, canvas and image layers all accept it; layers without it draw where
they were added. `MapLineLayer` also takes a `filter` and a URL for `data`.

`MapGeoJsonLayer` draws an arbitrary FeatureCollection — an uploaded overlay,
say — in one colour: polygons filled and outlined, lines stroked, points as
circles, all sharing `layerOrder`, `clickHtml` and `hoverHtml`.

`MapCanvasLayer` pins a canvas the host paints (an interpolated surface from a
worker) to four corners; build them with `boundsToQuad({ west, south, east,
north })`. Change `revision` after repainting so MapLibre uploads the new
pixels, or set `animate` for a canvas that changes every frame.
`MapImageLayer` does the same for an image URL. Pass `id` when the host has to look
the source or layer up; otherwise one is generated.
A host running its own timed drawing, such as a crossfade, passes `onSource` to receive the
`CanvasSource` and calls `play` and `pause` itself; `revision` is then ignored. `id` names the
source and layer, and `beforeId` can be a function that finds a layer once the style is ready.

`MapRasterLayer` takes `fadeDuration`; use 0 for data rasters that must not blend while
tiles load.
`bounds` limits tile requests, `id` gives the source and layer a stable name, and
`addOnStyleLoad` adds the layer once the style is usable rather than after the map's first
full load, for imagery the map opens to show.

`MapTerrain` adds relief shading and 3D terrain from one elevation dataset, keeping the
separate sources MapLibre needs for the two. The host supplies `dem`, and optionally
`sky` and `terrainGroundColor` for the 3D view, so a workspace keeps its own look:

```tsx
<MapTerrain id="site" dem={{ tiles: [url], encoding: 'terrarium', maxZoom: 15 }} terrain={is3d} />
```

`Map` also supports a host that manages its own sources and layers, such as a point-cloud
viewer. `onMapCreate` runs once on construction and may return a release function;
`onCreateError` receives a constructor failure instead of it throwing; `containerProps`
sets attributes on the map's element. Pass one object as both `styles`, so a theme change
cannot replace the style. `draggableCompass` on `MapControls` turns and tilts by dragging.

`reliefOnly` on `MapTerrain` draws just the hillshade and leaves terrain and sky to whatever
owns them, and `beforeId` places it under a host's data. `captureMapImage` takes `overlays`,
a function resolving to copies of canvases drawn separately from the map. Take each copy in
that renderer's after-render callback, because a WebGL canvas reads back blank later.
`terrainOnly` is the reverse: 3D terrain with no hillshade, leaving the sky alone, which a
globe view relies on.

`WORKSPACE_MAP_CONTROLS` is `DEFAULT_MAP_CONTROLS` plus fullscreen, for a workspace whose
map is the main surface.

```tsx
<MapCanvasLayer canvas={canvas} coordinates={boundsToQuad(grid.bounds)} revision={grid} layerOrder={1} />
<MapCircleLayer data={sensors} color={['get', 'color']} layerOrder={2} clickHtml={sensorPopupHtml} />
```

## Map lifecycle helpers

`onMoveEnd` reports the settled camera with its visible `bounds` after load,
every pan or zoom, and container resizes. `onViewportChange` fires on every
frame instead; use `onMoveEnd` for work such as recomputing a viewport grid.

`fallbackStyles` (light/dark, like `styles`) replaces a basemap that fails to
load or has not loaded within `styleTimeoutMs` (8 s by default), so data layers
still draw offline; `onStyleFallback` reports the switch. A theme change tries
the requested style again.

Basemaps label places in their own script, and MapLibre needs its RTL text
plugin to join and order Arabic, Hebrew and other right-to-left labels. `Map`
registers it on first use from `DEFAULT_RTL_TEXT_PLUGIN_URL` (a pinned CDN copy
of `@mapbox/mapbox-gl-rtl-text`); it is fetched only once such a label is on
screen. Pass `rtlTextPlugin` a self-hosted URL where scripts must come from your
own origin, or `false` when the host registers the plugin itself. One
registration serves every map on the page; `ensureRtlTextPlugin(url?)` does the
same for a host that creates MapLibre maps without `Map`. If the plugin cannot
load, those labels draw as before and the map is unaffected.

`captureMapImage(map)` renders a fresh frame and encodes it (PNG by default)
without needing `preserveDrawingBuffer`; download the blob with `downloadBlob`
from `/export`. Only the WebGL canvas is captured, not HTML markers or panels.

`MapControls` `trackLocation` turns the locate button into a toggle that follows
the user's position with a marker.

`PlaybackControls` steps a host-owned frame index with play/pause,
previous/next and a scrubber, for time-lapse maps.

`mode="continuous"` seeks a continuous position instead — metres along a route,
seconds into a recording — and runs no timer: the host's animation loop
advances `value` while `playing`. It takes `value`, `min` (default 0), `max`,
`step` (the scrubber's granularity), `onValueChange`, `playing` and
`onPlayingChange`; `canPlay={false}` holds play while keeping pause. `skip`
adds ‹ › buttons that move by it and pause ("Back {skipLabel}" /
"Forward {skipLabel}"; hidden on `workspace-max-sm`). `formatValue` formats the
default "value / max" label (the "/ max" hidden on narrow workspaces) and the
spoken "value of max"; `valueLabel` and `valueText` replace them. `seekLabel`
names the scrubber (default "Position"), `pauseOnScrub` (default true) pauses
on a drag, `playButton="labelled"` draws a primary Play/Pause button with its
word, and `actions` takes extra controls at the end of the row. `clampPlaybackValue`
is the pure clamp it uses.

```tsx
<PlaybackControls
  mode="continuous"
  value={metres}
  max={routeLength}
  step={5}
  onValueChange={seek}
  playing={playing}
  onPlayingChange={setPlaying}
  skip={10}
  skipLabel="10 m"
  formatValue={(m) => `${(m / 1000).toFixed(2)} km`}
  seekLabel="Route position"
  playButton="labelled"
  actions={<SpeedPicker />}
/>
```

### Map timeline

`MapTimeline` (`/ui`) is the timeline for time-based map data: transport
controls, the current window's label, and one track that is both the histogram
and the scrubber. Build its buckets with `buildTimelineBuckets` (`/calculations`)
and key your per-bucket values with `timelineBucketKey`, so the two agree.

```tsx
const buckets = buildTimelineBuckets({ start, end, granularity: 'month' })
const range = timelineWindow(buckets.length, value, size, 'end') // filter your data with this
<MapTimeline
  buckets={buckets}
  value={value}
  onValueChange={setValue}
  granularity="month"
  values={countsByBucketKey}
  window={{ size, onSizeChange: setSize, anchor: 'end', options: [{ value: 3, label: '3 mo' }, { value: 'cumulative', label: 'Cumul.' }] }}
  change={{ label: 'YoY', offset: 12 }}
  summary="1,204 visible"
  onClose={close}
/>
```

- **Value.** The value is the index of the bucket the window is anchored on:
  its first bucket for a start anchor, its last for an end anchor or a
  cumulative window. `timelineWindow` and `timelineWindowDates` give the
  buckets and dates the window covers. `formatTimelineWindow` gives its label.
- **Layout.** It lays itself out from its own width, not the viewport's:
  - one row at 880 px or more (960 px on a touch screen);
  - two rows with window and speed under an options button from 420 px;
  - a phone layout below that.

  On short maps (a landscape phone) the track gets shorter. Touch screens get
  44 px controls. `density` fixes a layout. The options swap in for the track at
  the track's height, so chrome stacked above doesn't jump.

- **Few buckets.** With 12 or fewer (`isTimelinePicker`) every bucket is its own
  target, so the timeline becomes a picker: bars keep a bar's proportions, the
  selected ones stand in for the playhead, and the skip and speed controls go,
  as do the step buttons on a phone, where the arrow keys still step.
  It is capped at 36 rem wide and needs 520 px for one row (560 px on touch).
- **Window options.** `timelineWindowOptions` drops fixed windows as long as the
  data, which only repeat the end of the cumulative window, and offers nothing
  for a single bucket. The selected option always stays.
- **Change.** `change` compares one bucket with another, so it reads out only
  while the window is one bucket long.
- **Interaction.**
  - Press or drag anywhere on the track to scrub, and hover for a tooltip.
  - Holding a step button keeps stepping.
  - Pressing Play on the last bucket starts over.
  - The track is a `role="slider"` with the window label as `aria-valuetext`.
    Arrows step, PageUp/PageDown move a larger period, Home/End jump to the
    ends and Space plays.
- **Map chrome.** As a map overlay (the default; `placement="inline"` for a
  sidebar or dashboard) it floats above the phone sheet. It publishes its
  footprint as `--map-timeline-height` on every enclosing layout root, so
  legends, the attribution, controls and floating panels stack above it.
  Selection framing keeps features clear of it. On phones, opening it drops the
  sheet to its peek height.

The bottom-right corner of a map is shared, from the bottom up:

1. the timeline;
2. MapLibre's attribution, whose height `Map` publishes as
   `--map-bottom-right-controls-height`;
3. a `MapLegendPanel`, which publishes `--map-legend-panel-visible-height`, and
   `--map-legend-stack-height` with the attribution added, while it sits in that
   corner;
4. any bottom-corner controls or floating panels.

Opening a legend therefore moves nothing below it.

Zoom and compass default to the top right, below a floating phone toolbar,
whose height the workspace publishes as `--map-mobile-toolbar-height`.

`MapOverlay` sits at a fixed `top-3`/`bottom-3` inset by default. Pass
`clearChrome` to keep it clear of the same chrome instead: top positions clear
the phone toolbar (`max(0.75rem, toolbar + 0.25rem)`, so `top-3` when there is
none); bottom positions clear the phone sheet, the safe area and a mounted
timeline; the bottom corners also stack above MapLibre's corner controls, the
right one above the legend panel and, on phones, the left one above the legend
stack. `bottom-center` clears the sheet, safe area and timeline only. A
`className` inset still overrides it.

```tsx
<MapOverlay position="bottom-left" clearChrome className="max-w-[15rem]">
  …
</MapOverlay>
```

### Settled viewport observation

`/map` exports `MapViewportSnapshot`, `readMapViewport`, `observeMapViewport`,
`useObserveMapViewport` and `useMapViewport`. A snapshot contains
`bounds: [west, south, east, north]`, `zoom`, and canvas `width` / `height`.

```ts
const unsubscribe = observeMapViewport(
  map,
  ({ bounds, zoom }) => {
    updateVisibleArea(bounds, zoom)
  },
  { events: ['moveend', 'resize'], initial: 'loaded' },
)
// On teardown:
unsubscribe()
```

`events` defaults to `['load', 'moveend', 'zoomend', 'resize']`; duplicate event
names are subscribed once. `initial` is `'loaded'` by default, or `'always'` /
`'none'` when the host needs a different initial-publication policy.
`useObserveMapViewport(map, callback, options)` keeps callback changes separate
from event subscriptions. `useMapViewport(map, options)` returns the latest
snapshot or `null` before one is published for that map. Both hooks accept
`enabled` and `refreshKey`; changing the key republishes according to `initial`
even without a map gesture. These are settled-event helpers, not per-frame
camera or drawing controllers.

### Screen-point clustering

`clusterScreenPoints<T>(items, options)` clusters HTML-marker records in projected
screen pixels. Required options are `getId`, `getCoordinates` and `radius`.
`project` supplies the screen projection and optional `viewport: { width, height }`
plus `padding` rejects offscreen points. Optional `priority` sorts stably in
ascending order; each item joins the first cluster within the inclusive radius.
Cluster positions are incremental means. Results retain the original records as
`{ id, longitude, latitude, items }`; `idPrefix` defaults to `'cluster'`.
Without `project`, each input is a singleton in its original order.

`useScreenPointClusters(map, items, options)` supplies MapLibre projection and
settled viewport observation. A null map uses singleton fallback. The host owns
marker rendering, priority meaning, and cluster-click behavior. This API does not
replace the map-source clustering used by `MapClusterLayer`.

## Offline maps and site framing

`geojsonBasemapStyle({ land, water, landColor, borderColor, graticule })`
returns a complete MapLibre style built from one GeoJSON land layer, with no
tile server, glyphs or sprites. Pass it as both `styles.light` and
`styles.dark` (with theme colours) for static sites and exports. Without
glyphs, label places with markers rather than symbol layers.

`pointBounds(points, { trim, pad, minSpan })` frames finite `[lon, lat]` points;
`trim` drops a quantile from each end so a few overseas sites do not shrink the
rest. `fitMapToPoints(map, points, options)` applies it with `fitBounds`.

## Form fields and numeric ranges

`/ui` exports `FormField`, `NativeSelect`, `SelectField`, `CheckboxField`,
`NumberField`, `NullableNumberField`, `FORM_INPUT_CLASS` and their props.

- `CheckboxField` is a checkbox and its label for an option ("Hide edge
  candidates"): `checked` / `onCheckedChange(boolean)`, optional `description`
  (associated with the input) and `disabled`. Other input props, such as
  `aria-label`, reach the native checkbox. Use `ToggleRow` for a layer or data
  source switched on and off.

- `FormField` takes a `label`, children, optional `hint` / `description` / `error`,
  and label/content/wrapper classes. It associates direct native inputs and
  `NativeSelect` with their label and help text, preserving existing
  `aria-describedby` IDs. Compound controls can supply `htmlFor` and
  `descriptionId`. `group` names multiple controls; `hintAction` sits outside
  the label and `hideLabel` retains an accessible label.
- `NativeSelect` forwards native `SelectHTMLAttributes` and its ref. It supports
  multiple selection, option groups, native keyboard operation and all native
  change/focus events. If `className` is supplied it is used unchanged; only an
  omitted class gets `FORM_INPUT_CLASS`. `SelectField` combines it with a field
  wrapper: `className` styles the select and `fieldClassName` styles the wrapper.
- `NumberField` takes a finite numeric `value` / `onValueChange`;
  `NullableNumberField` also accepts/emits `null`. Both retain editing drafts,
  expose `min` / `max` / `step`, units (`unit` or `suffix`), help/error text and
  `onCommit`. `updateOn` defaults to `'change'`, with `'commit'` for blur/Enter
  updates. `clampOn` defaults to `'commit'`; `'change'` clamps immediately and
  `'never'` leaves typed bounds advisory. Required blank input restores by
  default; `blankValue="zero"` is explicit. Nullable blank input is `null`;
  `invalidValue="null"` also clears invalid nullable input when requested.
- Numeric source precision is retained by default. An untouched blur emits no
  change. Optional `precision` controls edit-display and keyboard-step rounding;
  a caller can request `precision={6}` for an existing dense editor. Rounded
  values drop trailing zeros (`283`); `fixedDecimals` keeps all of them
  (`283.00`) so a table column lines up at the decimal point, and
  `formatNumberFieldValue` is the pure formatter both use. Typed
  measurements are not globally snapped to `step`. `stepMode="native"` is the
  default and retains browser arrow-key alignment to the native step grid.
  `stepMode="increment"` uses `stepNumberFieldValue` (default rounding precision 6) to step a raw draft and then bound the result, preserving custom road
  editors. `resolveNumberFieldInput` and
  `stepNumberFieldValue` are also exported as pure helpers with their policy and
  result types.

```tsx
import { NumberField, NullableNumberField, SelectField } from '@pgmaps/geo-toolkit/ui'

<NumberField label="Distance" value={distance} onValueChange={setDistance}
  min={0} max={10000} step={0.5} unit="m" updateOn="commit" />
<NullableNumberField label="Observed height" value={height} onValueChange={setHeight}
  min={0} unit="m" placeholder="Not measured" />
<SelectField label="Basemap" value={basemap} onChange={event => setBasemap(event.target.value)}>
  <option value="vector">Vector</option>
  <option value="satellite">Satellite</option>
</SelectField>
```

`NumericRangeField` shares a controlled range's label, value/unit display and
optional description. It takes numeric `value` / `onChange`, `min` / `max` / `step`
(defaults 0 / 100 / 1), optional formatted `display`, `hideValue`, and
`layout="split" | "inline"`. Native input props and refs are forwarded, with
label/help/value-text associations. `renderControl(controlProps)` adapts a custom
slider while retaining the same numeric, disabled and accessibility contract.
The host decides when a change triggers expensive work. Its props and
`NumericRangeControlProps` are exported from `/ui`.

## Share bars and gradient ticks

`ShareBars` draws each row's share as a bar against a fixed `max` (default 100),
never against the largest row, so two lists read against each other. Each item
has a `label`, one value per `series` (`null` draws an empty bar) and an optional
`display` replacing the formatted text. `series` entries take a `label` prefix
("A", "B"), a fill `className` or `color`. `layout="inline"` puts label, bar and
value on one row (a distribution across bins); `"stacked"` puts the bars under the
label, for comparing series. `StackedShareBar` splits one bar into coloured
`segments` of a `total`, e.g. a recorded mixture.

`MapGradientLegendItem` takes `ticks` for evenly spaced labels in place of
`minLabel` / `maxLabel`, plus `barClassName` and `labelClassName` for a denser
legend strip.

## Local files and tool pages

`FileDropField` takes local files from a button, an optional folder button, or a drop,
walking dropped folders. It calls `onFiles` with `PickedFile` entries that keep each
file's relative path, and does not filter drops by `accept`; filter in `onFiles` if the
workspace needs to. `multiple={false}` makes the button pick one file, for an import;
a drop still hands over every file, so take the first. `filesFromInput` and
`filesFromDrop` are the same reads without React.

`FileButton` is the single-button form for a toolbar or panel import: a `Button` (outline,
`sm` by default; other `Button` props pass through) over a hidden file input named by
`label`. `onFiles` receives `File[]` and is not called for a cancelled picker; `accept`,
`multiple` and `inputProps` go to the input. `takeInputFiles` is its read without React: it
copies an input's files, then clears the input so the same file can be chosen again.

`ToolPageHeader` heads a tool that is a scrolling page. `MapSidebarShell` takes
`density="compact"` for a tighter sidebar; every `SidebarSection` inside follows it.
`SidebarSection variant="subsection"` is a titled block nested in another section
or a `StepSection`: a lighter hairline above, no rule below and a level-3 heading
by default (`headingLevel` still overrides it).

`ColorField` picks a colour or leaves it unset: `value: string | null`,
`onChange(string | null)` and an accessible `label` for the colour input. The
swatch opens the native colour input; `presets` show as a row of swatches and in
the picker's own list (`presetDisplay="picker"` keeps them in the list only, for
a dense row); unset draws striped with a dashed border, titled `unsetTitle`
(default "Default colour: choose one"); while a colour is set, a reset button
named `resetLabel` (default "Reset {label}") returns `null`. `size="sm"` is a
14 px swatch for a list row. Colours are emitted as lower-case `#rrggbb`;
`normalizeHexColor` is the pure normalizer and `pickerFallback` the colour the
picker opens on while unset.

```tsx
<ColorField
  value={block.color}
  onChange={setColor}
  label={`Colour for ${block.name}`}
  resetLabel={`Reset colour of ${block.name}`}
  presets={['#ffffff', '#facc15', '#f97316']}
/>
```

Pass `size="lg"` on a hub page that lists tools.

## Clipboard feedback and transports

`/ui` exports `useClipboardText`, `CopyButton`, `createClipboardController`,
`writeClipboardText`, `copyTextWithSelection`, and their contracts.

`useClipboardText(options)` returns `{ status, error, text, copy, reset }`.
`status` is `'idle' | 'pending' | 'copied' | 'failed'`; `copy` accepts a string
or an async string producer and returns `Promise<boolean>`. Feedback resets after
`resetAfterMs` (default 1800) or `failureResetAfterMs` (default 2400); zero retains
feedback until reset. Each instance is independent. Unmount/reset clears timers
and supersedes pending producers/writes, and an older attempt cannot overwrite a
newer snapshot. `createClipboardController` exposes the same state via
`getSnapshot` / `subscribe` for a host without React.

The default transport uses `navigator.clipboard.writeText`; absent support is a
failure. `writeText` can inject a host transport. Optional `fallback(text, error)`
can copy using a host mechanism; `false` or a throw indicates continued failure.
`copyTextWithSelection` is an opt-in browser fallback that restores the previous
focus and selection. No fallback is silently enabled.

`CopyButton` takes `text`, optional state labels or `renderLabel(snapshot)`, and
`options`. It disables itself while pending, reports busy/live state, and calls
`onResult({ copied, text })` for host-owned manual-copy UI. Preserve URL
serialization, validation and domain-specific error messages in the host.

## Floating notifications

`/ui` exports one notification card and the stack that places it.

- `NotificationCard` draws a notice: `tone` (`info`, `loading`, `success`,
  `warning`, `error`), `title`, `message`, `icon` (replaces the tone's icon;
  `null` drops it), `progress` (`{ value, max, label?, valueText? }`, a
  determinate bar plus "`value` of `max`"), `action` beside the text, `actions`
  in a row below, `onDismiss` + `dismissLabel` for a close button. `error` is
  `role="alert"` (assertive); every other tone is `role="status"` (polite).
  Remaining props, such as `aria-label` and `data-*`, go on the card.
- `NotificationViewport` is the fixed stack: bottom-right (24rem) from Tailwind's
  `sm`, full width along the bottom below it, above the safe-area inset, at
  `z-notification` (2200). It lets clicks through between cards. Cards stack in
  arrival order.
- `NotificationProvider` owns one stack for its subtree; mount it once near the
  root. `<Notification>` shows while it is mounted (the host owns its presence and
  `onDismiss` asks the host to remove it). `useNotifications()` returns the store:
  `push(options)` returns an id, and `update`, `dismiss`, `remove`, `clear`.
  Pushed `success` and `info` notices close themselves after
  `NOTIFICATION_DURATION` (5 s, 6 s); `loading`, `warning` and `error` stay. The
  timers pause while the pointer or focus is in the stack. `duration` overrides
  the default; `0` or `null` keeps a notice.
- `createNotificationStore` is the same state without React, for pushing from
  outside a component; hand it to `NotificationProvider store={…}`.

Cards render where the provider is, so `action`/`actions` content reads React
context from there, not from the component that declared it. A `<Notification>`
outside any provider renders its own viewport, so two of them would overlap: use a provider wherever more than one can show. In a standalone
consumer, render the provider inside a `.geo-toolkit` element (such as
`WorkspaceProvider`) so its scoped styles apply. Cards animate in with
`.geo-motion-notification` and leave without an exit animation; reduced motion
drops the entry too.

## Numeric scrub field

`ScrubNumberField` edits one number: drag sideways to scrub (a full-width drag
spans `min`–`max`; Shift is ×0.1), click or press Enter to type (units and a
decimal comma are accepted; Escape cancels), arrow keys step (Shift ×10). The
tinted bar shows the value's place in the range. It is plain CSS, so it works
outside a workspace; theme it with `--gt-scrub-accent`, `--gt-scrub-bg`,
`--gt-scrub-border`, `--gt-scrub-border-hover`, `--gt-scrub-text`,
`--gt-scrub-muted`, `--gt-scrub-h`, `--gt-scrub-w`, `--gt-scrub-radius` and
`--gt-scrub-font`. `onChange` fires per frame; `onCommit` once per gesture.

## Donut ring maps

`DonutRingMap` draws a world map ringed by one donut per place, each joined to
its place by a leader line, as one d3-drawn SVG (it prints and exports as
vector art). `layoutDonutRing({ width, land, places })` is its pure layout: the
largest radius whose ring of slots holds every place, the fitted projection,
and each place's slot, chosen by `assignRing` so leaders keep the places'
angular order and do not cross. Values are drawn counter-clockwise from the
top in legend order; pass `emphasized` for legend hover and `itemProps` for
host tooltips and data attributes.
