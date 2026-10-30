import { describe, expect, it } from 'vitest'
import { cameraOffset, visibleMapInsets } from './camera-framing.js'

const map = { left: 50, top: 100, right: 450, bottom: 800 }
describe('visible map framing', () => {
  it('moves the target above the highest of stacked sheets without adding their heights', () => {
    const insets = visibleMapInsets(map, [
      { left: 50, top: 500, right: 450, bottom: 1000 },
      { left: 56, top: 494, right: 444, bottom: 900 },
    ])
    expect(insets).toEqual({ top: 0, left: 0, right: 0, bottom: 318 })
    expect(cameraOffset(insets)).toEqual([0, -159])
  })
  it('does not count desktop sidebars outside the already-resized map pane', () => {
    expect(visibleMapInsets(map, [{ left: 0, top: 100, right: 50, bottom: 800 }])).toEqual({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    })
  })
  it('does not reframe for a small floating control', () => {
    expect(visibleMapInsets(map, [{ left: 390, top: 730, right: 440, bottom: 790 }]).bottom).toBe(0)
  })
  it('keeps at least 80 pixels of visible camera space when a sheet fills the map', () => {
    expect(visibleMapInsets(map, [{ left: 50, top: 90, right: 450, bottom: 800 }]).bottom).toBe(620)
  })
  it('accounts for a tall panel overlaid on one side', () => {
    expect(cameraOffset(visibleMapInsets(map, [{ left: 250, top: 100, right: 450, bottom: 800 }]))).toEqual([-106, 0])
  })
  it('recognizes a full-height inspector covering most of a narrow desktop map', () => {
    expect(visibleMapInsets(map, [{ left: 170, top: 100, right: 450, bottom: 800 }])).toEqual({
      top: 0,
      left: 0,
      right: 292,
      bottom: 0,
    })
  })
})
