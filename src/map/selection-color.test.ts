import { describe, expect, it } from 'vitest'
import { SELECTION_COLOR } from './map-styles.js'
import { selectionColorFromChannels } from './selection-color.js'

describe('selectionColorFromChannels', () => {
  it('keeps the standard highlight when no theme sets the tint', () => {
    expect(selectionColorFromChannels('')).toBe(SELECTION_COLOR)
    expect(selectionColorFromChannels(undefined)).toBe(SELECTION_COLOR)
    expect(selectionColorFromChannels(null)).toBe(SELECTION_COLOR)
  })

  it('turns r g b channels into a colour MapLibre accepts', () => {
    expect(selectionColorFromChannels(' 47 142 100 ')).toBe('rgb(47, 142, 100)')
    expect(selectionColorFromChannels('47, 142, 100')).toBe('rgb(47, 142, 100)')
  })

  it('ignores a value that is not three channels', () => {
    expect(selectionColorFromChannels('47 142')).toBe(SELECTION_COLOR)
    expect(selectionColorFromChannels('initial')).toBe(SELECTION_COLOR)
    expect(selectionColorFromChannels('300 0 0')).toBe(SELECTION_COLOR)
  })
})
