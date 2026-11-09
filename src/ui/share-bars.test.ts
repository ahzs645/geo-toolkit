import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CheckboxField } from './form-field.js'
import { MapGradientLegendItem } from './map-panels.js'
import { ShareBars, StackedShareBar } from './share-bars.js'

describe('share bars', () => {
  it('draws each value against the full scale, clamped, with one bar per series', () => {
    const html = renderToStaticMarkup(
      createElement(ShareBars, {
        'aria-label': 'Profile',
        items: [
          { label: '0–2 m', values: [25, 50] },
          { label: '2–5 m', values: [140, null] },
        ],
        series: [{ label: 'A' }, { label: 'B', className: 'bg-blue-500' }],
        layout: 'stacked',
      }),
    )
    expect(html).toContain('aria-label="Profile"')
    expect(html).toContain('width:25%')
    expect(html).toContain('width:50%')
    expect(html).toContain('width:100%')
    expect(html).toContain('width:0%')
    const text = html.replace(/<[^>]*>/g, '')
    expect(text).toContain('A 25.0% · B 50.0%')
    expect(text).toContain('A 140.0% · B –')
    expect(html).toContain('bg-blue-500')
  })

  it('splits a stacked bar by share of the total', () => {
    const html = renderToStaticMarkup(
      createElement(StackedShareBar, {
        total: 200,
        segments: [
          { key: 'a', value: 50, color: '#ff0000', title: 'A 25%' },
          { key: 'b', value: 150, color: '#0000ff' },
        ],
      }),
    )
    expect(html).toContain('title="A 25%"')
    expect(html).toContain('width:25%;background-color:#ff0000')
    expect(html).toContain('width:75%;background-color:#0000ff')
  })
})

describe('checkbox field', () => {
  it('names the checkbox by its label and associates its description', () => {
    const html = renderToStaticMarkup(
      createElement(CheckboxField, {
        id: 'edge',
        label: 'Hide tile-edge candidates',
        description: 'Edge crowns may be truncated.',
        checked: true,
        onCheckedChange: () => undefined,
      }),
    )
    expect(html).toContain('<label for="edge"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('aria-describedby="edge-description"')
    expect(html).toContain('id="edge-description"')
  })
})

describe('gradient legend ticks', () => {
  it('prints evenly spaced ticks in place of min and max', () => {
    const html = renderToStaticMarkup(
      createElement(MapGradientLegendItem, { colors: ['#000', '#fff'], ticks: ['0 m', '20 m', '40 m'] }),
    )
    expect(html.match(/<span>/g)).toHaveLength(3)
    expect(html).toContain('40 m')
  })
})
