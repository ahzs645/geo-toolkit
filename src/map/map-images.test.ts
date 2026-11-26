import { describe, expect, it } from 'vitest'
import { retainMapImage, type MapImageHost } from './map-images.js'

function fakeMap() {
  const images = new Map<string, unknown>()
  const listeners = new Set<(event: { id: string }) => void>()
  const map = {
    hasImage: (id: string) => images.has(id),
    addImage: (id: string, image: unknown) => void images.set(id, image),
    removeImage: (id: string) => void images.delete(id),
    on: (_type: string, listener: (event: { id: string }) => void) => listeners.add(listener),
    off: (_type: string, listener: (event: { id: string }) => void) => listeners.delete(listener),
  }
  return { map: map as unknown as MapImageHost, images, listeners }
}

const tile = { id: 'hatch-a', width: 2, height: 2, data: new Uint8ClampedArray(16), pixelRatio: 2 }

describe('retainMapImage', () => {
  it('shares one image between layers and removes it with the last', () => {
    const { map, images, listeners } = fakeMap()
    const first = retainMapImage(map, tile)
    const second = retainMapImage(map, tile)
    expect(images.has('hatch-a')).toBe(true)
    expect(listeners.size).toBe(1)
    first()
    first()
    expect(images.has('hatch-a')).toBe(true)
    second()
    expect(images.has('hatch-a')).toBe(false)
    expect(listeners.size).toBe(0)
  })

  it('adds the image again when the style loses it', () => {
    const { map, images, listeners } = fakeMap()
    const release = retainMapImage(map, tile)
    images.clear()
    for (const listener of listeners) listener({ id: 'other' })
    expect(images.has('hatch-a')).toBe(false)
    for (const listener of listeners) listener({ id: 'hatch-a' })
    expect(images.has('hatch-a')).toBe(true)
    release()
  })
})
