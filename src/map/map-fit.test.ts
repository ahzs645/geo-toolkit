import { describe, expect, it } from 'vitest'
import { pointBounds } from './map-fit.js'
import { geojsonBasemapStyle, graticuleLines } from './offline-basemap.js'

describe('pointBounds', () => {
  it('pads a spread of points and ignores non-finite ones', () => {
    const box = pointBounds(
      [
        [0, 0],
        [10, 20],
        [Number.NaN, 5],
        [200, 0],
      ],
      { pad: 0 },
    )
    expect(box).toEqual([
      [0, 0],
      [10, 20],
    ])
  })

  it('gives a single point a regional frame', () => {
    expect(pointBounds([[30, 10]], { pad: 0, minSpan: 4 })).toEqual([
      [28, 8],
      [32, 12],
    ])
    expect(pointBounds([])).toBeNull()
  })

  it('trims outliers from five points up', () => {
    const points: [number, number][] = [
      [-120, 40],
      [-110, 35],
      [-100, 45],
      [-90, 38],
      [-80, 42],
      [150, -10],
    ]
    const [[w], [e]] = pointBounds(points, { trim: 0.2, pad: 0 })!
    expect(e).toBeLessThan(0)
    expect(w).toBeGreaterThan(-120)
  })
})

describe('geojsonBasemapStyle', () => {
  it('builds a self-contained style with optional graticule and borders', () => {
    const land: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
    const style = geojsonBasemapStyle({ land, graticule: 30, borderWidth: 0 })
    expect(style.glyphs).toBeUndefined()
    expect(style.layers.map((l) => l.id)).toEqual(['basemap-background', 'basemap-graticule', 'basemap-land'])
    // 13 meridians from -180 to 180; parallels -60 … 60 (±90 would leave the ±80 Mercator frame)
    expect(graticuleLines(30).features.length).toBe(13 + 5)
  })
})
