import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import { Map, useMap, useFlyToSelection } from '@pgmaps/geo-toolkit/map'
import { WorkspaceProvider, MapSectionLayout, MAP_SIDEBAR_CLASS } from '@pgmaps/geo-toolkit/workspace'
import { MapSidebarShell } from '@pgmaps/geo-toolkit/ui/map-panels'
import { MobileFeatureCard } from '@pgmaps/geo-toolkit/ui/mobile-feature-card'
import '@pgmaps/geo-toolkit/styles.css'

declare global {
  interface Window {
    __motionMap?: MapLibreMap
  }
}

const locations = {
  A: { longitude: -122.75, latitude: 53.915 },
  B: { longitude: -122.65, latitude: 53.945 },
}
const style: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e5eef0' } }],
}
const mapStyles = { light: style, dark: style }

function MapProbe({ selected }: { selected: keyof typeof locations | null }) {
  const { map, isLoaded } = useMap()
  useFlyToSelection(selected ? locations[selected] : null, { zoom: 12, focusKey: selected })
  useEffect(() => {
    if (!map) return
    window.__motionMap = map
    return () => {
      if (window.__motionMap === map) delete window.__motionMap
    }
  }, [map])
  return <span hidden data-testid="map-state" data-loaded={isLoaded} />
}

function Fixture() {
  const [selected, setSelected] = useState<keyof typeof locations | null>(null)
  const [comparison, setComparison] = useState(false)
  const [closed, setClosed] = useState(0)
  const [rightOpen, setRightOpen] = useState(true)
  const [tableOpen, setTableOpen] = useState(false)
  return (
    <>
      <nav aria-label="Fixture controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 8 }}>
        <button onClick={() => setSelected('A')}>Select A</button>
        <button onClick={() => setSelected('B')}>Select B</button>
        <button onClick={() => setComparison((value) => !value)}>Toggle comparison</button>
        <button onClick={() => setTableOpen((value) => !value)}>Toggle table</button>
        <output data-testid="closed-count">{closed}</output>
      </nav>
      <div style={{ position: 'absolute', inset: '72px 0 0' }} data-testid="workspace">
        <WorkspaceProvider placement="container" responsive="container">
          <MapSectionLayout
            sidebar={
              <MapSidebarShell className={MAP_SIDEBAR_CLASS} title="Motion controls">
                <label>
                  Sidebar note
                  <input aria-label="Sidebar note" defaultValue="Keep this edit" />
                </label>
                <button>Sidebar action</button>
              </MapSidebarShell>
            }
            rightSidebar={
              <div style={{ padding: 16 }}>
                <label>
                  Results note
                  <input aria-label="Results note" defaultValue="Keep results edit" />
                </label>
              </div>
            }
            showDesktopRightSidebar={rightOpen}
            onToggleDesktopRightSidebar={() => setRightOpen((value) => !value)}
            desktopSidebarWidth={280}
            desktopRightSidebarWidth={280}
            mobileInitialSheetState="half"
            mobilePeekTitle="Motion controls"
            mobilePeekSubtitle="Move and resize the panel"
            bottomPaneHeight={160}
            bottomPane={tableOpen ? <input aria-label="Table note" defaultValue="Table edit" /> : undefined}
          >
            <Map
              styles={mapStyles}
              center={[-122.75, 53.915]}
              zoom={10}
              controls={null}
              loader="spinner"
              attributionControl={false}
            >
              <MapProbe selected={selected} />
            </Map>
          </MapSectionLayout>
          {/* Host-owned cards can be siblings of the layout; the workspace bus
              still owns their stacking and visible map-area registration. */}
          {selected && (
            <MobileFeatureCard
              title={`Feature ${selected}`}
              cardKey={selected}
              stackId="selection"
              height={520}
              initialVisibleHeight={280}
              onClose={() => {
                setClosed((count) => count + 1)
                setSelected(null)
              }}
            >
              <label>
                Selected feature note
                <input aria-label="Selected feature note" defaultValue="Keep selected edit" />
              </label>
              <button>Feature action</button>
            </MobileFeatureCard>
          )}
          {comparison && (
            <MobileFeatureCard
              title="Comparison"
              stackId="comparison"
              height={500}
              initialVisibleHeight={300}
              onClose={() => setComparison(false)}
            >
              <input aria-label="Comparison note" defaultValue="Comparison edit" />
            </MobileFeatureCard>
          )}
        </WorkspaceProvider>
      </div>
    </>
  )
}

document.documentElement.style.cssText = 'height:100%;overflow:hidden'
document.body.style.cssText = 'margin:0;height:100%;font:14px sans-serif'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
)
