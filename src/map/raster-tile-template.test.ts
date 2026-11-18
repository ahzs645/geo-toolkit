import { describe, expect, it } from 'vitest'
import { xyzTileTemplate } from './raster-tile-template.js'

describe('xyzTileTemplate', () => {
  it.each([
    ['/{level}/{row}/{col}', '/{z}/{y}/{x}'],
    ['?row={TileRow}&matrix={TileMatrix}&col={TileCol}&copy={TILEROW}', '?row={y}&matrix={z}&col={x}&copy={y}'],
    ['/{z}/{x}/{y}.png?name=Row', '/{z}/{x}/{y}.png?name=Row'],
  ])('preserves the provider’s order in %s', (input, expected) => {
    expect(xyzTileTemplate(input)).toBe(expected)
  })
  it('rejects an incomplete grid address', () => {
    expect(() => xyzTileTemplate('/{level}/{row}/{row}')).toThrow(/column/)
  })
})
