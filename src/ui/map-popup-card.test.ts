import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MapPopupCard } from './map-popup-card.js'

const noop = () => {}

/** Each button's label and class list, in the order drawn. */
function buttons(html: string) {
  const footer = html.slice(html.indexOf('data-map-popup-footer'))
  return [...footer.matchAll(/<button class="([^"]*)"[^>]*>(?:<span[^>]*>)?([^<]*)(?:<\/span>)?<\/button>/g)].map(
    ([, cls, label]) => ({
      label,
      filled: cls.includes('bg-primary'),
      outline: cls.includes('border-input'),
      fullWidth: / w-full( |$)/.test(cls),
    }),
  )
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

  it('shortens a label too long for its row with an ellipsis, the whole label as its tooltip', () => {
    const label = 'Stand here, facing northwest, at the block'
    const html = renderToStaticMarkup(
      createElement(MapPopupCard, {
        title: 'A',
        footerActions: [
          { label, onClick: noop, primary: true },
          { label: 'Arrow 2: northwest, at the block', onClick: noop },
          { label: 'Arrow 3: north', onClick: noop },
        ],
      }),
    )
    const footer = html.slice(html.indexOf('data-map-popup-footer'))
    const drawn = [
      ...footer.matchAll(/<button class="([^"]*)"[^>]*title="([^"]*)"[^>]*><span class="([^"]*)">([^<]*)<\/span>/g),
    ]
    expect(drawn.map(([, , title, , text]) => [title, text])).toEqual([
      [label, label],
      ['Arrow 2: northwest, at the block', 'Arrow 2: northwest, at the block'],
      ['Arrow 3: north', 'Arrow 3: north'],
    ])
    // The label ends in an ellipsis rather than overflowing the centred button at both ends.
    for (const [, , , spanClass] of drawn)
      expect(spanClass.split(' ')).toEqual(expect.arrayContaining(['min-w-0', 'truncate']))
    // Side-by-side buttons keep their automatic minimum width (no `min-w-0`), held to the row by `max-w-full`, so a
    // label that does not fit beside the others takes a row of its own before it is ever shortened.
    for (const [, buttonClass] of drawn.slice(1)) {
      expect(buttonClass.split(' ')).toEqual(expect.arrayContaining(['flex-1', 'max-w-full']))
      expect(buttonClass.split(' ')).not.toContain('min-w-0')
    }
  })
})
