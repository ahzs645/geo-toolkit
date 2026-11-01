import { describe, expect, it, vi } from 'vitest'
import {
  mapCoveredBottom,
  onMapCoveredBottomChange,
  resizeMap,
  setMapCoveredBottom,
  visibleMapBounds,
} from './map-resize.js'

describe('resizeMap', () => {
  it('redraws synchronously after resizing so a cleared canvas is never presented', () => {
    const calls: string[] = []
    resizeMap({
      resize: vi.fn(() => {
        calls.push('resize')
        return undefined as never
      }),
      redraw: vi.fn(() => {
        calls.push('redraw')
        return undefined as never
      }),
    })
    expect(calls).toEqual(['resize', 'redraw'])
  })
})

/** A flat, unrotated camera: screen pixels map linearly to degrees. */
function fakeMap(height = 600) {
  const state = { center: { lng: 0, lat: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 24 } }
  const paddedCentre = () => ({
    x: (800 + state.padding.left - state.padding.right) / 2,
    y: (height + state.padding.top - state.padding.bottom) / 2,
  })
  // 1 px = 0.01°, latitude increasing upwards.
  const unproject = ([x, y]: [number, number]) => {
    const c = paddedCentre()
    return { lng: state.center.lng + (x - c.x) * 0.01, lat: state.center.lat - (y - c.y) * 0.01 }
  }
  const project = (lngLat: { lng: number; lat: number }) => {
    const c = paddedCentre()
    return { x: c.x + (lngLat.lng - state.center.lng) / 0.01, y: c.y - (lngLat.lat - state.center.lat) / 0.01 }
  }
  const map = {
    getContainer: () => ({ clientHeight: height }),
    getCanvas: () => ({ clientWidth: 800, clientHeight: height }),
    getPadding: () => ({ ...state.padding }),
    getCenter: () => ({ ...state.center }),
    project,
    unproject,
    getBounds: () => {
      const nw = unproject([0, 0])
      const se = unproject([800, height])
      return { getWest: () => nw.lng, getNorth: () => nw.lat, getEast: () => se.lng, getSouth: () => se.lat }
    },
    jumpTo: ({ center, padding }: { center: { lng: number; lat: number }; padding: typeof state.padding }) => {
      state.center = center
      state.padding = padding
    },
  }
  const typed = map as unknown as Parameters<typeof setMapCoveredBottom>[0] & typeof map
  const fired: string[] = []
  onMapCoveredBottomChange(typed, () => fired.push('covered'))
  return { map: typed, state, fired, unproject }
}

describe('setMapCoveredBottom', () => {
  it('pads the covered strip while every visible pixel keeps showing the same place', () => {
    const { map, state, fired, unproject } = fakeMap()
    const before = [unproject([10, 20]), unproject([400, 300]), unproject([790, 590])]
    setMapCoveredBottom(map, 320)
    expect(state.padding).toEqual({ top: 0, right: 0, bottom: 320, left: 24 })
    const after = [unproject([10, 20]), unproject([400, 300]), unproject([790, 590])]
    after.forEach((point, index) => {
      expect(point.lng).toBeCloseTo(before[index].lng, 9)
      expect(point.lat).toBeCloseTo(before[index].lat, 9)
    })
    expect(mapCoveredBottom(map)).toBe(320)
    expect(fired).toEqual(['covered'])
  })

  it('returns exactly to the original camera when the pane closes', () => {
    const { map, state } = fakeMap()
    setMapCoveredBottom(map, 320)
    setMapCoveredBottom(map, 500)
    setMapCoveredBottom(map, 0)
    expect(state.padding.bottom).toBe(0)
    expect(state.center.lng).toBeCloseTo(0, 9)
    expect(state.center.lat).toBeCloseTo(0, 9)
  })

  it('keeps a camera destination under a full-screen pane and preserves host padding', () => {
    const { map, state } = fakeMap(600)
    state.padding.bottom = 40
    setMapCoveredBottom(map, 600)
    expect(mapCoveredBottom(map)).toBe(520)
    expect(state.padding.bottom).toBe(560)
    setMapCoveredBottom(map, 0)
    expect(state.padding.bottom).toBe(40)
  })

  it('does nothing when the coverage is unchanged', () => {
    const { map, fired } = fakeMap()
    setMapCoveredBottom(map, 0)
    expect(fired).toEqual([])
  })
})

describe('visibleMapBounds', () => {
  it('excludes the canvas under a docked pane', () => {
    const { map } = fakeMap()
    const full = visibleMapBounds(map)
    setMapCoveredBottom(map, 200)
    const visible = visibleMapBounds(map)
    expect(visible.north).toBeCloseTo(full.north, 9)
    expect(visible.west).toBeCloseTo(full.west, 9)
    expect(visible.east).toBeCloseTo(full.east, 9)
    expect(visible.south).toBeCloseTo(full.south + 2, 9)
  })
})
