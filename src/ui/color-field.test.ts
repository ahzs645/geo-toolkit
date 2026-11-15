import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { ColorField, normalizeHexColor } from './color-field.js'
import { ColorPickerPanel } from './color-picker.js'
import { clearRecentColors, recentColors, rememberColor, RECENT_COLOR_LIMIT } from './recent-colors.js'

const PRESETS = ['#FFFFFF', '#facc15', '#abc', 'tomato']

describe('colour field', () => {
  it('normalizes only a six-digit colour, leaving opacity to its own value', () => {
    expect(normalizeHexColor('#ABC')).toBe('#aabbcc')
    expect(normalizeHexColor('FACC15')).toBe('#facc15')
    expect(normalizeHexColor(' #7c3aed ')).toBe('#7c3aed')
    expect(normalizeHexColor('#7c3aed80')).toBeNull()
    expect(normalizeHexColor('tomato')).toBeNull()
    expect(normalizeHexColor(null)).toBeNull()
  })

  it('draws unset as striped and dashed, titled to choose one, with no reset', () => {
    const html = renderToStaticMarkup(
      createElement(ColorField, { value: null, onChange: () => {}, label: 'Colour for Block 12' }),
    )
    expect(html).toContain('repeating-linear-gradient')
    expect(html).toContain('border-style:dashed')
    expect(html).toContain('title="Default colour: choose one"')
    expect(html).toContain('data-unset="true"')
    // The swatch is the button that opens the picker; the picker is not in the page until then.
    expect(html).toMatch(/<button type="button" aria-label="Colour for Block 12"/)
    expect(html).not.toContain('data-color-picker')
    expect(html).not.toContain('Reset')
  })

  it('draws a set colour with a named reset button', () => {
    const html = renderToStaticMarkup(
      createElement(ColorField, {
        value: '#F97316',
        onChange: () => {},
        label: 'Colour for Block 12',
        resetLabel: 'Reset colour of Block 12',
      }),
    )
    expect(html).toContain('background-color:#F97316')
    expect(html).not.toContain('repeating-linear-gradient')
    expect(html).toContain('title="Colour for Block 12"')
    expect(html).toContain('data-color-value="#f97316"')
    expect(html).toMatch(/<button type="button"[^>]*aria-label="Reset colour of Block 12"/)
    expect(html).not.toContain('data-unset')
  })

  it('leaves the reset button out for a colour that cannot be unset', () => {
    const html = renderToStaticMarkup(
      createElement(ColorField, { value: '#f97316', onChange: () => {}, label: 'Material colour', resettable: false }),
    )
    expect(html).not.toContain('Reset')
  })

  it('lists valid presets as swatches beside the field, marking the current one', () => {
    const html = renderToStaticMarkup(
      createElement(ColorField, { value: '#facc15', onChange: () => {}, label: 'Block colour', presets: PRESETS }),
    )
    expect(html).toContain('aria-label="Block colour: presets"')
    expect(html).toContain('aria-label="Block colour: #ffffff" aria-pressed="false"')
    expect(html).toContain('aria-label="Block colour: #facc15" aria-pressed="true"')
    expect(html).toContain('aria-label="Block colour: #aabbcc"')
    expect(html).not.toContain('tomato')
  })

  it('keeps presets in the picker only when asked, for a dense row', () => {
    const html = renderToStaticMarkup(
      createElement(ColorField, {
        value: null,
        onChange: () => {},
        label: 'Block colour',
        presets: PRESETS,
        presetDisplay: 'picker',
        size: 'sm',
      }),
    )
    expect(html).not.toContain('aria-label="Block colour: presets"')
    expect(html).toContain('h-3.5 w-3.5')
  })

  it('draws a supplied swatch in place of the plain colour', () => {
    const html = renderToStaticMarkup(
      createElement(ColorField, {
        value: '#111827',
        onChange: () => {},
        label: 'Line colour',
        swatch: createElement('i', { 'data-line': '' }),
      }),
    )
    expect(html).toContain('<i data-line=""></i>')
    expect(html).not.toContain('background-color:#111827')
  })

  it('disables every control', () => {
    const html = renderToStaticMarkup(
      createElement(ColorField, {
        value: '#111827',
        onChange: () => {},
        label: 'Block colour',
        presets: ['#ffffff'],
        disabled: true,
      }),
    )
    expect(html.match(/disabled=""/g)).toHaveLength(3)
  })
})

describe('colour picker panel', () => {
  const panel = (props: Partial<Parameters<typeof ColorPickerPanel>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(ColorPickerPanel, { value: '#7c3aed', onCommit: () => {}, label: 'Buffer colour', ...props }),
    )

  it('names a plane, a hue rail and a hex box after the field, and opens on the colour in use', () => {
    const html = panel()
    expect(html).toContain('aria-label="Buffer colour: saturation and brightness"')
    expect(html).toContain('aria-label="Buffer colour: hue"')
    expect(html).toMatch(/<input type="text" aria-label="Buffer colour: hex"[^>]*value="#7c3aed"/)
    expect(html).not.toContain('opacity"')
    expect(html).not.toContain('Presets')
  })

  it('opens on the fallback while no colour is chosen', () => {
    expect(panel({ value: null, fallback: '#22D3EE' })).toContain('value="#22d3ee"')
    expect(panel({ value: null })).toContain('value="#ffffff"')
  })

  it('adds an opacity rail only with somewhere to report it', () => {
    expect(panel({ opacity: 0.4 })).not.toContain('Buffer colour: opacity')
    const html = panel({ opacity: 0.4, onOpacityCommit: () => {} })
    expect(html).toContain('aria-label="Buffer colour: opacity"')
    expect(html).toContain('aria-valuetext="40%"')
  })

  it('lists presets and recent colours once each, marking the colour in use', () => {
    const html = panel({ presets: ['#7C3AED', '#7c3aed', '#fff', 'tomato'], recent: ['#facc15'] })
    expect(html.match(/aria-label="Presets: /g)).toHaveLength(2)
    expect(html).toContain('aria-label="Presets: #7c3aed" aria-pressed="true"')
    expect(html).toContain('aria-label="Recent: #facc15" aria-pressed="false"')
  })
})

describe('recent colours', () => {
  afterEach(clearRecentColors)

  it('keeps the newest first, once each, up to the limit', () => {
    for (let i = 0; i < RECENT_COLOR_LIMIT + 3; i++) rememberColor(`#0000${i.toString(16).padStart(2, '0')}`)
    rememberColor('#000005')
    expect(recentColors()).toHaveLength(RECENT_COLOR_LIMIT)
    expect(recentColors()[0]).toBe('#000005')
    expect(recentColors().filter((color) => color === '#000005')).toHaveLength(1)
    expect(recentColors()).not.toContain('#000000')
  })
})
