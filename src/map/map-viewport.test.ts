import type * as MapLibreGL from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { observeMapViewport, type MapViewportEvent } from './map-viewport.js'

function fakeMap(loaded = true) {
  const listeners = new Map<MapViewportEvent, Set<() => void>>()
  const source = {
    loaded: () => loaded,
    getBounds: () => ({ getWest: () => -125, getSouth: () => 50, getEast: () => -120, getNorth: () => 55 }),
    getZoom: () => 8,
    getCanvas: () => ({ clientWidth: 800, clientHeight: 500 }),
    on: (event: MapViewportEvent, callback: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(callback)
    },
    off: (event: MapViewportEvent, callback: () => void) => listeners.get(event)?.delete(callback),
  }
  return {
    map: source as unknown as MapLibreGL.Map,
    emit: (event: MapViewportEvent) => listeners.get(event)?.forEach((callback) => callback()),
    count: () => [...listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0),
  }
}

describe('settled map viewport observation', () => {
  it('publishes the initial loaded viewport and releases every listener', () => {
    const map = fakeMap()
    const change = vi.fn()
    const stop = observeMapViewport(map.map, change)
    expect(change).toHaveBeenLastCalledWith({ bounds: [-125, 50, -120, 55], zoom: 8, width: 800, height: 500 })
    expect(map.count()).toBe(4)
    map.emit('moveend')
    map.emit('zoomend')
    map.emit('resize')
    expect(change).toHaveBeenCalledTimes(4)
    stop()
    expect(map.count()).toBe(0)
    map.emit('moveend')
    expect(change).toHaveBeenCalledTimes(4)
  })

  it('waits for load when requested and keeps independent maps isolated', () => {
    const first = fakeMap(false)
    const second = fakeMap()
    const firstChange = vi.fn()
    const secondChange = vi.fn()
    const stopFirst = observeMapViewport(first.map, firstChange)
    const stopSecond = observeMapViewport(second.map, secondChange)
    expect(firstChange).not.toHaveBeenCalled()
    first.emit('load')
    expect(firstChange).toHaveBeenCalledTimes(1)
    expect(secondChange).toHaveBeenCalledTimes(1)
    stopFirst()
    second.emit('resize')
    expect(secondChange).toHaveBeenCalledTimes(2)
    stopSecond()
  })

  it('preserves explicit event/initial policies and deduplicates events', () => {
    const map = fakeMap(false)
    const change = vi.fn()
    const stop = observeMapViewport(map.map, change, { initial: 'always', events: ['moveend', 'moveend'] })
    expect(change).toHaveBeenCalledTimes(1)
    expect(map.count()).toBe(1)
    map.emit('resize')
    map.emit('moveend')
    expect(change).toHaveBeenCalledTimes(2)
    stop()
    const stopPassive = observeMapViewport(map.map, change, { initial: 'none', events: [] })
    expect(change).toHaveBeenCalledTimes(2)
    expect(map.count()).toBe(0)
    stopPassive()
  })
})
