import { describe, expect, it } from 'vitest'
import { clusterScreenPoints, type ScreenPointClusterOptions } from './screen-point-clusters.js'

type Item = { id: string; point: [number, number]; priority?: number }
const options: ScreenPointClusterOptions<Item> = {
  getId: (item) => item.id,
  getCoordinates: (item) => item.point,
  radius: 54,
  padding: 140,
  viewport: { width: 400, height: 300 },
  project: ([x, y]) => ({ x, y }),
}

describe('screen-point marker clustering', () => {
  it('keeps singleton input order before projection is available', () => {
    const items: Item[] = [
      { id: 'later', point: [10, 20], priority: 2 },
      { id: 'first', point: [11, 21], priority: 0 },
    ]
    expect(clusterScreenPoints(items, { ...options, project: undefined, priority: (item) => item.priority! })).toEqual([
      { id: 'later', longitude: 10, latitude: 20, items: [items[0]] },
      { id: 'first', longitude: 11, latitude: 21, items: [items[1]] },
    ])
  })

  it('uses priority order, first-match membership and incremental centroids without mutating records', () => {
    const items: Item[] = [
      { id: 'low', point: [60, 0], priority: 3 },
      { id: 'high', point: [0, 0], priority: 0 },
      { id: 'bridge', point: [40, 0], priority: 1 },
      { id: 'far', point: [200, 0], priority: 2 },
    ]
    const clusters = clusterScreenPoints(items, { ...options, priority: (item) => item.priority! })
    expect(clusters.map((cluster) => cluster.items.map((item) => item.id))).toEqual([
      ['high', 'bridge', 'low'],
      ['far'],
    ])
    expect(clusters[0].id).toBe('cluster-0-0-high')
    expect(clusters[0].longitude).toBeCloseTo(100 / 3)
    expect(clusters[0].latitude).toBe(0)
    expect(clusters[0].items[0]).toBe(items[1])
    expect(items.map((item) => item.id)).toEqual(['low', 'high', 'bridge', 'far'])
  })

  it('keeps points exactly on the radius and padded viewport edges', () => {
    const items: Item[] = [
      { id: 'a', point: [0, 0] },
      { id: 'b', point: [54, 0] },
      { id: 'edge', point: [540, 440] },
      { id: 'outside', point: [540.1, 440] },
    ]
    expect(clusterScreenPoints(items, options).map((cluster) => cluster.items.map((item) => item.id))).toEqual([
      ['a', 'b'],
      ['edge'],
    ])
  })

  it('handles coincident points, invalid projections and specialized cluster ids', () => {
    const items: Item[] = [
      { id: 'a', point: [10.4, 20.6] },
      { id: 'b', point: [10.4, 20.6] },
      { id: 'invalid', point: [NaN, 0] },
    ]
    expect(clusterScreenPoints(items, { ...options, idPrefix: 'specialist-cluster' })).toEqual([
      { id: 'specialist-cluster-10-21-a', longitude: 10.4, latitude: 20.6, items: items.slice(0, 2) },
    ])
    expect(clusterScreenPoints([], options)).toEqual([])
  })
})
