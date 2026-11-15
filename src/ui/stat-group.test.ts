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
