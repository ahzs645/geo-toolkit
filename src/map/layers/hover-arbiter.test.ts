import type * as MapLibreGL from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { isClickOutranked, isTopHoverLayer, registerHoverLayer } from './hover-arbiter.js'

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

  it('lets a layer of higher pick priority show its card from under a lower one', () => {
    // A study area drawn over an arrow it holds: the arrow answers, though it is drawn below.
    const { map } = fakeMap(['area', 'arrow'])
    registerHoverLayer(map, 'area', () => true, { priority: () => -1 })
    registerHoverLayer(map, 'arrow')
    expect(isTopHoverLayer(map, [10, 10], 'arrow')).toBe(true)
    expect(isTopHoverLayer(map, [10, 10], 'area')).toBe(false)
  })
})

describe('click arbiter', () => {
  const clickable = () => true

  it('gives the click to a layer of higher pick priority with a feature under it', () => {
    const { map } = fakeMap(['point', 'area'])
    registerHoverLayer(map, 'point', () => true, { clickable })
    registerHoverLayer(map, 'area', () => true, { clickable, priority: () => -1 })
    expect(isClickOutranked(map, [10, 10], 'area')).toBe(true)
    expect(isClickOutranked(map, [10, 10], 'point')).toBe(false)
  })

  it('leaves the click to the lower layer where nothing above it is under the pointer, or does nothing on a click', () => {
    const { map } = fakeMap(['area'], ['area', 'point', 'labels'])
    registerHoverLayer(map, 'point', () => true, { clickable })
    registerHoverLayer(map, 'labels')
    registerHoverLayer(map, 'area', () => true, { clickable, priority: () => -1 })
    expect(isClickOutranked(map, [10, 10], 'area')).toBe(false)

    const covered = fakeMap(['labels', 'area'])
    registerHoverLayer(covered.map, 'labels', () => true, { clickable: () => false })
    registerHoverLayer(covered.map, 'area', () => true, { clickable, priority: () => -1 })
    expect(isClickOutranked(covered.map, [10, 10], 'area')).toBe(false)
  })

  it('gives every layer of equal priority the click, without a query', () => {
    const { map, queryRenderedFeatures } = fakeMap(['point', 'polygons'])
    registerHoverLayer(map, 'point', () => true, { clickable })
    registerHoverLayer(map, 'polygons', () => true, { clickable })
    expect(isClickOutranked(map, [10, 10], 'polygons')).toBe(false)
    expect(isClickOutranked(map, [10, 10], 'point')).toBe(false)
    expect(queryRenderedFeatures).not.toHaveBeenCalled()
  })
})
