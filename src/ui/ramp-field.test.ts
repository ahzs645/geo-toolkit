import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RampField } from './ramp-field.js'

const RAMPS = [
  { id: 'heat', label: 'Yellow–red', colors: ['#ffffb2', '#bd0026'] },
  { id: 'rdbu', label: 'Red–blue', colors: ['#b2182b', '#f7f7f7', '#2166ac'] },
]

describe('ramp field', () => {
  it('shows the chosen ramp as its gradient and names it for a screen reader', () => {
    const html = renderToStaticMarkup(
      createElement(RampField, { value: 'heat', onChange: () => {}, ramps: RAMPS, label: 'Colour ramp' }),
    )
    expect(html).toContain('aria-label="Colour ramp: Yellow–red"')
    expect(html).toContain('linear-gradient(to right, #ffffb2, #bd0026)')
    expect(html).not.toContain('reversed')
  })

  it('draws the ramp reversed and offers the flip only with somewhere to report it', () => {
    const html = renderToStaticMarkup(
      createElement(RampField, {
        value: 'heat',
        onChange: () => {},
        ramps: RAMPS,
        label: 'Colour ramp',
        reverse: true,
        onReverseChange: () => {},
      }),
    )
    expect(html).toContain('linear-gradient(to right, #bd0026, #ffffb2)')
    expect(html).toContain('aria-label="Colour ramp: Yellow–red, reversed"')
  })

  it('shows an id it does not know as its own text, never as another ramp', () => {
    const html = renderToStaticMarkup(
      createElement(RampField, { value: 'gone', onChange: () => {}, ramps: RAMPS, label: 'Colour ramp' }),
    )
    expect(html).toContain('aria-label="Colour ramp: gone"')
    expect(html).not.toContain('linear-gradient')
  })

  it('lists a person’s own gradient by its custom id, as anchors sampled from its stops', () => {
    const html = renderToStaticMarkup(
      createElement(RampField, {
        value: 'custom:Dusk',
        onChange: () => {},
        ramps: RAMPS,
        label: 'Colour ramp',
        custom: { ramps: [{ name: 'Dusk', stops: ['#000000', '#ffffff'] }], onSave: () => {}, onDelete: () => {} },
      }),
    )
    expect(html).toContain('aria-label="Colour ramp: Dusk"')
    expect(html).toMatch(/linear-gradient\(to right, #000000, .*#ffffff\)/)
  })
})
