import { describe, expect, it } from 'vitest'
import { exposeMapTransform } from './map-transform.js'

describe('exposeMapTransform', () => {
  it('answers `map.transform` from the camera on a MapLibre 6 map, following a transform it replaces', () => {
    const first = { height: 844 }
    const map = { _camera: { transform: first } } as { _camera: { transform: object }; transform?: object }
    exposeMapTransform(map)
    expect(map.transform).toBe(first)
    const next = { height: 600 }
    map._camera.transform = next
    expect(map.transform).toBe(next)
  })

  it('leaves a map that has its own transform alone (MapLibre 5)', () => {
    const own = { height: 500 }
    const map = { transform: own, _camera: { transform: { height: 1 } } }
    exposeMapTransform(map)
    expect(map.transform).toBe(own)
  })

  it('is safe to call again, and on a map with no camera yet', () => {
    const map = {} as { transform?: unknown }
    exposeMapTransform(map)
    exposeMapTransform(map)
    expect(map.transform).toBeUndefined()
  })
})
