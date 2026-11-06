import { useMemo, useState } from 'react'
import { Map } from '@pgmaps/geo-toolkit/map'
import { MapSectionLayout, WorkspaceProvider, MAP_SIDEBAR_CLASS } from '@pgmaps/geo-toolkit/workspace'
import { LegendItem, MapLegendPanel, MapTimeline } from '@pgmaps/geo-toolkit/ui'
import {
  buildTimelineBuckets,
  formatTimelineWindow,
  timelineWindow,
  type TimelineWindowSize,
} from '@pgmaps/geo-toolkit/calculations'
import { styles } from './mapStyles'

const WINDOW_OPTIONS = [
  { value: 1, label: '1 mo' },
  { value: 3, label: '3 mo' },
  { value: 12, label: '1 yr' },
  { value: 'cumulative', label: 'Cumul.' },
] as const

const buckets = buildTimelineBuckets({ start: new Date(2019, 0, 1), end: new Date(2025, 11, 1), granularity: 'month' })

/** Fictional monthly sightings: a seasonal swing on a slow rise, with a gap. */
const sightings = new globalThis.Map(
  buckets.map((bucket, index) => {
    const month = bucket.start.getMonth()
    const seasonal = Math.max(0, Math.sin(((month - 2) / 12) * Math.PI * 2))
    const value = index >= 14 && index <= 16 ? 0 : Math.round(20 + index * 0.6 + seasonal * 90)
    return [bucket.key, value]
  }),
)

/** A map timeline over fictional data, on a map with a legend, as a page would use it. */
export function TimelineExperience() {
  const [value, setValue] = useState(buckets.length - 1)
  const [size, setSize] = useState<TimelineWindowSize>(3)
  const range = timelineWindow(buckets.length, value, size, 'end')
  const total = useMemo(() => {
    let sum = 0
    for (let i = range.start; i <= range.end; i++) sum += sightings.get(buckets[i].key) ?? 0
    return sum
  }, [range.start, range.end])
  const label = formatTimelineWindow(buckets, range, { cumulative: size === 'cumulative', granularity: 'month' })

  return (
    <main style={{ height: '100vh', width: '100%', padding: 0 }}>
      <WorkspaceProvider>
        <MapSectionLayout
          sidebar={
            <div className={MAP_SIDEBAR_CLASS} style={{ padding: 16 }}>
              <h1 style={{ fontSize: 16, fontWeight: 600 }}>Heron sightings</h1>
              <p style={{ fontSize: 13 }}>Fictional monthly counts, 2019–2025.</p>
              <output aria-label="Window total">{total.toLocaleString()}</output>
            </div>
          }
          desktopSidebarWidth={280}
          mobilePeekTitle="Heron sightings"
          mobilePeekSubtitle={label}
        >
          <Map
            styles={styles}
            center={[-2.75, 50.95]}
            zoom={6.2}
            loader="spinner"
            attributionControl={{ compact: true, customAttribution: 'Example attribution' }}
          >
            <MapLegendPanel title="Sightings" collapsible width="sm">
              <LegendItem color="hsl(var(--primary))" label="In the window" />
              <LegendItem color="#cbd5e1" label="Outside it" />
            </MapLegendPanel>
            <MapTimeline
              label="Sightings timeline"
              buckets={buckets}
              value={value}
              onValueChange={setValue}
              granularity="month"
              values={sightings}
              valueLabel="sightings"
              window={{ size, onSizeChange: setSize, options: WINDOW_OPTIONS, anchor: 'end' }}
              change={{ label: 'YoY', offset: 12 }}
              summary={`${total.toLocaleString()} sightings`}
              onClose={() => setValue(buckets.length - 1)}
            />
          </Map>
        </MapSectionLayout>
      </WorkspaceProvider>
    </main>
  )
}
