import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MapPopupCard } from './map-popup-card.js'

const noop = () => {}

/** Each button's label and class list, in the order drawn. */
function buttons(html: string) {
  const footer = html.slice(html.indexOf('data-map-popup-footer'))
  return [...footer.matchAll(/<button class="([^"]*)"[^>]*>([^<]*)<\/button>/g)].map(([, cls, label]) => ({
    label,
    filled: cls.includes('bg-primary'),
    outline: cls.includes('border-input'),
    fullWidth: / w-full( |$)/.test(cls),
  }))
}

describe('map popup card footer', () => {
  it('draws no footer without footer actions', () => {
    expect(renderToStaticMarkup(createElement(MapPopupCard, { title: 'A' }))).not.toContain('data-map-popup-footer')
    expect(renderToStaticMarkup(createElement(MapPopupCard, { title: 'A', footerActions: [] }))).not.toContain(
      'data-map-popup-footer',
    )
  })

  it('gives buttons that open another view the same outline, sharing a row', () => {
    const html = renderToStaticMarkup(
      createElement(MapPopupCard, {
        title: 'A',
        footerActions: [
          { label: 'Review', onClick: noop },
          { label: 'Evidence', onClick: noop },
        ],
      }),
    )
    expect(buttons(html)).toEqual([
      { label: 'Review', filled: false, outline: true, fullWidth: false },
      { label: 'Evidence', filled: false, outline: true, fullWidth: false },
    ])
  })

  it('draws the action that changes something filled, on its own row, first', () => {
    const html = renderToStaticMarkup(
      createElement(MapPopupCard, {
        title: 'A',
        footerActions: [
          { label: 'Review', onClick: noop },
          { label: 'Load', onClick: noop, primary: true },
        ],
      }),
    )
    expect(buttons(html)).toEqual([
      { label: 'Load', filled: true, outline: false, fullWidth: true },
      { label: 'Review', filled: false, outline: true, fullWidth: false },
    ])
  })
})
