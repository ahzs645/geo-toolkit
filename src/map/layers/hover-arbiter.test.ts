import type * as MapLibreGL from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { isTopHoverLayer, registerHoverLayer } from './hover-arbiter.js'

/** A map whose rendered features at any point are `stack`, topmost first. */
function fakeMap(stack: string[], existing = stack) {
  const queryRenderedFeatures = vi.fn((_point: unknown, options: { layers: string[] }) =>
    stack.filter((id) => options.layers.includes(id)).map((id) => ({ layer: { id } })),
  )
  const map = { getLayer: (id: string) => (existing.includes(id) ? { id } : undefined), queryRenderedFeatures }
  return { map: map as unknown as MapLibreGL.Map, queryRenderedFeatures }
}

describe('hover arbiter', () => {
  it('shows only the topmost card where a point sits over a polygon', () => {
    const { map } = fakeMap(['points', 'polygons'])
    registerHoverLayer(map, 'points')
    registerHoverLayer(map, 'polygons')
    expect(isTopHoverLayer(map, [10, 10], 'points')).toBe(true)
    expect(isTopHoverLayer(map, [10, 10], 'polygons')).toBe(false)
  })

  it('lets a layer without cards sit on top without hiding the card below it', () => {
    let pointCards = false
    const { map } = fakeMap(['points', 'polygons'])
    registerHoverLayer(map, 'points', () => pointCards)
    registerHoverLayer(map, 'polygons')
    expect(isTopHoverLayer(map, [10, 10], 'polygons')).toBe(true)
    pointCards = true
    expect(isTopHoverLayer(map, [10, 10], 'polygons')).toBe(false)
  })

  it('skips the query when one layer has cards, and forgets a layer once unregistered', () => {
    const { map, queryRenderedFeatures } = fakeMap(['points', 'polygons'])
    const unregister = registerHoverLayer(map, 'points')
    registerHoverLayer(map, 'polygons')
    unregister()
    expect(isTopHoverLayer(map, [10, 10], 'polygons')).toBe(true)
    expect(queryRenderedFeatures).not.toHaveBeenCalled()
  })

  it('ignores registered layers that are no longer on the map', () => {
    const { map } = fakeMap(['points', 'polygons'], ['polygons', 'lines'])
    registerHoverLayer(map, 'points')
    registerHoverLayer(map, 'polygons')
    registerHoverLayer(map, 'lines')
    expect(isTopHoverLayer(map, [10, 10], 'polygons')).toBe(true)
  })
})
