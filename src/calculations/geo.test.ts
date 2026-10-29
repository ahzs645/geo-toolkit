import { describe, expect, it } from 'vitest'
import { featureCollectionBounds, greatCircleArc, haversineKm } from './geo.js'

describe('greatCircleArc', () => {
  it('runs from start to end along the great circle', () => {
    const arc = greatCircleArc([38.76, 9.03], [-118.17, 34.2], { steps: 32 })
    expect(arc).toHaveLength(33)
    expect(arc[0][0]).toBeCloseTo(38.76)
    expect(arc[0][1]).toBeCloseTo(9.03)
    expect(arc[32][0]).toBeCloseTo(-118.17)
    expect(arc[32][1]).toBeCloseTo(34.2)
    // a great circle between these bows north of both ends
    expect(Math.max(...arc.map((p) => p[1]))).toBeGreaterThan(50)
    // equal steps: each hop is the same distance
    const hop = (i: number) => haversineKm(arc[i][1], arc[i][0], arc[i + 1][1], arc[i + 1][0])
    expect(hop(0)).toBeCloseTo(hop(20), 3)
  })

  it('keeps longitudes continuous across the antimeridian', () => {
    const arc = greatCircleArc([170, 0], [-170, 0], { steps: 4 })
    expect(arc.map((p) => Math.round(p[0]))).toEqual([170, 175, 180, 185, 190])
  })

  it('returns the two points for a zero-length route', () => {
    expect(greatCircleArc([1, 2], [1, 2])).toEqual([
      [1, 2],
      [1, 2],
    ])
  })
})

describe('featureCollectionBounds', () => {
  it('spans every feature and skips features without geometry', () => {
    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-123, 49] } },
        { type: 'Feature', properties: {}, geometry: null as unknown as GeoJSON.Geometry },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-122, 53],
                [-120, 53],
                [-120, 54],
                [-122, 53],
              ],
            ],
          },
        },
      ],
    }
    expect(featureCollectionBounds(collection)).toEqual([-123, 49, -120, 54])
  })

  it('returns null when nothing has coordinates', () => {
    expect(featureCollectionBounds({ type: 'FeatureCollection', features: [] })).toBeNull()
    expect(featureCollectionBounds(null)).toBeNull()
  })
})
