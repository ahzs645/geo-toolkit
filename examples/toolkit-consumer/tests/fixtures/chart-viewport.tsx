import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ChartViewport } from '@pgmaps/geo-toolkit/visualizations/react'

/** A chart slot as hosts lay it out: the plot fills a flex column, and readouts fold open below it. */
function Fixture() {
  const [details, setDetails] = useState(false)
  return (
    <>
      <button onClick={() => setDetails(!details)}>Details below chart</button>
      <div style={{ display: 'flex', flexDirection: 'column', height: 300, width: 320, overflow: 'hidden' }}>
        <ChartViewport className="viewport" minHeight={1} initialHeight={230}>
          {(height) => <div data-testid="plot" style={{ height, background: '#93c5fd' }} />}
        </ChartViewport>
        {details && <div style={{ height: 120, flexShrink: 0 }}>Legend and readouts</div>}
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
)
