import { describe, expect, it } from 'vitest'
import { featureClickEvent } from './feature-click.js'
import { boundsToQuad } from './canvas.js'

describe('featureClickEvent', () => {
  it('reports modifier keys and the clicked position', () => {
    expect(
      featureClickEvent({
        lngLat: { lng: -122.7, lat: 53.9 },
        originalEvent: Object.assign(new Event('click'), { shiftKey: true }),
      }),
    ).toEqual({ shiftKey: true, altKey: false, ctrlKey: false, metaKey: false, lngLat: [-122.7, 53.9] })
  })

  it('gives synthetic clicks a null position', () => {
    expect(featureClickEvent({}).lngLat).toBeNull()
  })
})

describe('boundsToQuad', () => {
  it('orders corners as MapLibre image sources expect', () => {
    expect(boundsToQuad({ west: -10, south: 40, east: 5, north: 50 })).toEqual([
      [-10, 50],
      [5, 50],
      [5, 40],
      [-10, 40],
    ])
  })
})
