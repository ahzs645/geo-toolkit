import { describe, expect, it } from 'vitest'
import { compassDragView } from './compass-drag.js'

describe('compass drag', () => {
  it('turns with horizontal movement and tilts with vertical movement', () => {
    expect(compassDragView({ bearing: 10, pitch: 20 }, 50, 0)).toEqual({ bearing: 50, pitch: 20 })
    expect(compassDragView({ bearing: 10, pitch: 20 }, 0, -40)).toEqual({ bearing: 10, pitch: 40 })
  })
})
