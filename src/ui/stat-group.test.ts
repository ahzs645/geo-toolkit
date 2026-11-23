import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatGroup } from './stat-group.js'

const classOf = (html: string, tag: string) => new RegExp(`<${tag} class="([^"]*)"`).exec(html)?.[1] ?? ''

describe('inline stat group', () => {
  const html = renderToStaticMarkup(
    createElement(StatGroup, {
      items: [
        { label: 'Selected supported area', value: '27.99 ha' },
        { label: 'Area-weighted density', value: '202.7 m³/ha' },
      ],
    }),
  )

  it('lets labels wrap so a narrow sidebar never scrolls sideways', () => {
    // A nowrap row of long labels was wider than the Forest volume sidebar.
    expect(html).not.toMatch(/<div class="[^"]*whitespace-nowrap/)
    expect(classOf(html, 'dt')).not.toContain('whitespace-nowrap')
    expect(classOf(html, 'dt')).toContain('text-balance')
  })

  it('keeps each value on one line and the values in one row', () => {
    expect(classOf(html, 'dd')).toContain('whitespace-nowrap')
    expect(classOf(html, 'dl')).toContain('items-start')
  })

  it('steps values down in a narrow row without replacing a page size', () => {
    expect(classOf(html, 'dl')).toContain('[container-type:inline-size]')
    const custom = renderToStaticMarkup(
      createElement(StatGroup, { items: [{ label: 'points', value: '12', valueClassName: 'text-sm' }] }),
    )
    const dd = classOf(custom, 'dd')
    expect(dd).toContain('text-sm')
    expect(dd).not.toMatch(/(^| )text-base( |$)/)
    expect(dd).toContain('[@container(max-width:14rem)]:[zoom:0.7]')
  })
})

describe('stat tiles', () => {
  it('writes each entry term first, with the note drawn under the label', () => {
    // HTML allows only a dt followed by its dds inside a dl's div; a dd before the dt is invalid.
    const html = renderToStaticMarkup(
      createElement(StatGroup, {
        variant: 'tiles',
        items: [{ label: 'Visible', value: '12%', note: 'of the landform', wrapLabel: true }],
      }),
    )
    const entry = /<div class="[^"]*flex-col-reverse[^"]*">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? ''
    const tags = [...entry.matchAll(/<(dt|dd)[ >]/g)].map((match) => match[1])
    expect(tags[0]).toBe('dt')
    expect(tags.slice(1).every((tag) => tag === 'dd')).toBe(true)
    expect(entry).toMatch(/<dd class="-order-1[^"]*">of the landform<\/dd>/)
  })
})
