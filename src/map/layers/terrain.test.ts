import { describe, expect, it, vi } from 'vitest'
import { releaseMapTerrain } from './terrain.js'

const ids = { hillshadeLayerId: 't-hillshade', hillshadeSourceId: 't-dem-hillshade', terrainSourceId: 't-dem-terrain' }

function liveMap() {
  const layers = new Set([ids.hillshadeLayerId])
  const sources = new Set([ids.hillshadeSourceId, ids.terrainSourceId])
  let terrain: { source: string } | null = { source: ids.terrainSourceId }
  const order: string[] = []
  return {
    order,
    map: {
      getTerrain: () => terrain,
      setTerrain: vi.fn((value: null) => {
        order.push('terrain')
        terrain = value
      }),
      getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
      removeLayer: vi.fn((id: string) => {
        order.push(`layer:${id}`)
        layers.delete(id)
      }),
      getSource: (id: string) => (sources.has(id) ? { id } : undefined),
      removeSource: vi.fn((id: string) => {
        order.push(`source:${id}`)
        sources.delete(id)
      }),
    },
  }
}

describe('releasing terrain', () => {
  it('releases terrain before the sources it reads from', () => {
    const { map, order } = liveMap()
    releaseMapTerrain(map as never, ids, { reliefOnly: false, terrainOnly: false })
    expect(order).toEqual([
      'terrain',
      `layer:${ids.hillshadeLayerId}`,
      `source:${ids.hillshadeSourceId}`,
      `source:${ids.terrainSourceId}`,
    ])
  })

  it('leaves terrain it does not own alone', () => {
    const { map, order } = liveMap()
    releaseMapTerrain(map as never, ids, { reliefOnly: true, terrainOnly: false })
    expect(order).toEqual([`layer:${ids.hillshadeLayerId}`, `source:${ids.hillshadeSourceId}`])
  })

  it('does nothing, and does not throw, on a map that was removed first', () => {
    // MapLibre's methods read its style, which `remove()` clears.
    const removed = new Proxy(
      {},
      {
        get: () => () => {
          throw new TypeError("Cannot read properties of undefined (reading '_checkLoaded')")
        },
      },
    )
    expect(() => releaseMapTerrain(removed as never, ids, { reliefOnly: false, terrainOnly: false })).not.toThrow()
  })
})
