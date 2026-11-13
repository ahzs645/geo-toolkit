import { describe, expect, it } from 'vitest'
import { parsePanelWindowLayouts } from './panel-window-layout.js'

describe('saved panel window placements', () => {
  it('keeps window bounds on a monitor to the left and a separate tab', () => {
    const placements = [
      { slot: 'plan', mode: 'window', width: 1400, height: 900, left: -1600, top: 20 },
      { slot: 'profile', mode: 'tab' },
    ]
    expect(parsePanelWindowLayouts(placements)).toEqual(placements)
  })

  it.each([
    null,
    [
      { slot: 'plan', mode: 'window' },
      { slot: 'plan', mode: 'tab' },
    ],
    [{ slot: 'plan', mode: 'iframe' }],
    [{ slot: '', mode: 'tab' }],
    [{ slot: 'plan', mode: 'window', width: -1 }],
    [{ slot: 'plan', mode: 'window', top: Number.NaN }],
    [{ slot: 'plan', mode: 'window', left: 2.5 }],
    [{ slot: 'plan', mode: 'window', url: 'https://example.com' }],
  ])('refuses invalid saved window settings: %j', (value) => {
    expect(() => parsePanelWindowLayouts(value)).toThrow()
  })
})
