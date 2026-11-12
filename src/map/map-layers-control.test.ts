import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MapControlsSideContext, MapLayersControl } from './map-layers-control.js'

const basemaps = [
  { value: 'map', label: 'Map' },
  { value: 'satellite', label: 'Satellite', description: 'Esri World Imagery' },
] as const

describe('MapLayersControl', () => {
  it('renders only its button while closed', () => {
    const html = renderToStaticMarkup(createElement(MapLayersControl, { basemaps, basemap: 'map' }))
    expect(html).toMatch(/<button[^>]*aria-label="Layers"[^>]*aria-expanded="false"/)
    expect(html).not.toContain('type="radio"')
  })

  it('lists basemaps as one radio group and overlays as checkboxes', () => {
    const html = renderToStaticMarkup(
      createElement(MapLayersControl, {
        defaultOpen: true,
        basemaps,
        basemap: 'satellite',
        overlays: [{ id: 'hillshade', label: 'Hillshade', checked: true, onCheckedChange: () => {} }],
      }),
    )
    expect(html).toContain('aria-expanded="true"')
    const radios = html.match(/<input type="radio"[^>]*>/g) ?? []
    expect(radios).toHaveLength(2)
    expect(new Set(radios.map((radio) => /name="([^"]+)"/.exec(radio)?.[1])).size).toBe(1)
    expect(radios.filter((radio) => radio.includes('checked'))).toEqual([expect.stringContaining('value="satellite"')])
    expect(html).toContain('Esri World Imagery')
    expect(html).toMatch(/data-overlay="hillshade"[^>]*>.*<input type="checkbox"[^>]*checked/)
    expect(html).toContain('>Basemap<')
    expect(html).toContain('>Overlays<')
  })

  it('opens towards the middle of the map from the stack it sits in', () => {
    const open = (side: 'left' | 'right' | null) =>
      renderToStaticMarkup(
        createElement(
          MapControlsSideContext.Provider,
          { value: side },
          createElement(MapLayersControl, { defaultOpen: true, basemaps, basemap: 'map' }),
        ),
      )
    expect(open('left')).toMatch(/role="group"[^>]*class="[^"]*left-0/)
    expect(open('right')).toMatch(/role="group"[^>]*class="[^"]*right-0/)
    expect(open(null)).toMatch(/role="group"[^>]*class="[^"]*right-0/)
  })
})
