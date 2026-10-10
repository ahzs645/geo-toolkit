import { describe, expect, it } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { buildBasemapStyle, type BasemapAppearance } from './basemap-appearance'

const appearance: BasemapAppearance = {
  backgroundColor: '#f8fafc',
  waterColor: '#bae6fd',
  landcoverColor: '#dcfce7',
  buildingColor: '#e2e8f0',
  countryBoundaryColor: '#94a3b8',
  otherBoundaryColor: '#64748b',
  roadColor: '#ffffff',
  labelColor: '#2563eb',
  labelHaloColor: '#f8fafc',
  showWater: true,
  showLandcover: true,
  showCountryBoundaries: true,
  showOtherBoundaries: false,
  showLabels: true,
}

describe('basemap appearance', () => {
  it('shares designer colors without changing source tiles, filters, zooms or the original style', () => {
    const source: StyleSpecification = {
      version: 8,
      glyphs: 'https://example.test/fonts/{fontstack}/{range}.pbf',
      sources: { base: { type: 'vector', tiles: ['https://example.test/{z}/{x}/{y}.pbf'] } },
      layers: [
        {
          id: 'water',
          type: 'fill',
          source: 'base',
          'source-layer': 'water',
          filter: ['==', 'class', 'lake'],
          minzoom: 3,
          paint: { 'fill-color': '#000000' },
        },
        { id: 'park', type: 'fill', source: 'base', 'source-layer': 'park' },
        { id: 'country', type: 'line', source: 'base', 'source-layer': 'boundary' },
        { id: 'province', type: 'line', source: 'base', 'source-layer': 'boundary' },
        {
          id: 'roads-case',
          type: 'line',
          source: 'base',
          'source-layer': 'transportation',
          paint: { 'line-color': '#aaaaaa' },
        },
        { id: 'roads', type: 'line', source: 'base', 'source-layer': 'transportation' },
        { id: 'river', type: 'line', source: 'base', 'source-layer': 'waterway' },
        {
          id: 'labels',
          type: 'symbol',
          source: 'base',
          'source-layer': 'place',
          layout: { 'text-field': '{name}' },
          paint: { 'text-color': '#000000', 'text-halo-color': '#ffffff' },
        },
      ],
    }
    const original = structuredClone(source)
    const result = buildBasemapStyle(source, appearance)
    expect(source).toEqual(original)
    expect(result.sources).toEqual(source.sources)
    expect(result.glyphs).toEqual(source.glyphs)
    expect(result.layers[0]).toMatchObject({
      filter: source.layers[0].filter,
      minzoom: 3,
      paint: { 'fill-color': appearance.waterColor },
    })
    expect(result.layers[1].paint).toMatchObject({ 'fill-color': appearance.landcoverColor })
    expect(result.layers[2].layout?.visibility).toBe('visible')
    expect(result.layers[3].layout?.visibility).toBe('none')
    expect(result.layers[4].paint).toEqual(source.layers[4].paint)
    expect(result.layers[5].paint).toMatchObject({ 'line-color': appearance.roadColor })
    expect(result.layers[6].paint).toMatchObject({ 'line-color': appearance.waterColor })
    expect(result.layers[7]).toMatchObject({
      layout: { 'text-field': '{name}' },
      paint: { 'text-color': appearance.labelColor, 'text-halo-color': appearance.labelHaloColor },
    })
    const hidden = buildBasemapStyle(source, { ...appearance, showWater: false, showLabels: false })
    expect(hidden.layers[0].layout?.visibility).toBe('none')
    expect(hidden.layers[6].layout?.visibility).toBe('none')
    expect(hidden.layers[7].layout?.visibility).toBe('none')
  })
})
