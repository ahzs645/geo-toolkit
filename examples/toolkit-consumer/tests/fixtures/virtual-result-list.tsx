import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { VirtualResultList } from '@pgmaps/geo-toolkit/ui/virtual-result-list'
import '@pgmaps/geo-toolkit/styles.css'

const results = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), index }))

function Fixture() {
  const [expanded, setExpanded] = useState(false)
  const [filtered, setFiltered] = useState(false)
  return (
    <>
      <button onClick={() => setExpanded(!expanded)}>Resize header</button>
      <button onClick={() => setFiltered(!filtered)}>Filter results</button>
      <div data-map-sidebar-scroll="true" style={{ height: 400, width: 320, overflowY: 'auto' }}>
        <div data-testid="header" style={{ height: expanded ? 311.25 : 93.25 }}>
          Filters and detail cards
        </div>
        <VirtualResultList
          items={filtered ? results.slice(0, 20) : results}
          getKey={(item) => item.id}
          estimateSize={60}
          label="Results"
        >
          {(item) => <button style={{ height: 40 + (item.index % 4) * 20 }}>Result {item.id}</button>}
        </VirtualResultList>
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
)
