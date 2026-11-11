import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ColorField, normalizeHexColor } from './color-field.js'

const PRESETS = ['#FFFFFF', '#facc15', '#abc', 'tomato']

describe('colour field', () => {
  it('normalizes only what a native colour input can hold', () => {
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
    // The picker still opens on a real colour.
    expect(html).toMatch(/<input type="color" aria-label="Colour for Block 12"[^>]*value="#ffffff"/)
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
    expect(html).toContain('value="#f97316"')
    expect(html).toMatch(/<button type="button"[^>]*aria-label="Reset colour of Block 12"/)
    expect(html).not.toContain('data-unset')
  })

  it('lists valid presets as swatches and in the picker, marking the current one', () => {
    const html = renderToStaticMarkup(
      createElement(ColorField, { value: '#facc15', onChange: () => {}, label: 'Block colour', presets: PRESETS }),
    )
    const listId = /list="([^"]+)"/.exec(html)?.[1]
    expect(listId).toBeTruthy()
    expect(html).toContain(`<datalist id="${listId}">`)
    expect(html.match(/<option /g)).toHaveLength(3)
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
    expect(html).toContain('<datalist')
    expect(html).not.toContain('aria-label="Block colour: presets"')
    expect(html).toContain('h-3.5 w-3.5')
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
