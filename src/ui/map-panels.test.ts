import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MapOverlay, MapSidebarShell, SidebarSection, type MapOverlayPosition } from './map-panels.js'

const classOf = (html: string) => /class="([^"]*)"/.exec(html)?.[1] ?? ''

describe('map overlay', () => {
  it('keeps the fixed insets without clearChrome', () => {
    const html = renderToStaticMarkup(createElement(MapOverlay, { position: 'top-right' }, 'x'))
    expect(classOf(html)).toBe(
      'absolute rounded-md border border-border bg-background/90 shadow-sm backdrop-blur-sm z-10 top-3 right-3',
    )
    expect(classOf(renderToStaticMarkup(createElement(MapOverlay, null, 'x')))).toContain('top-3 left-3')
  })

  it('clears the phone toolbar at the top, keeping top-3 when there is none', () => {
    for (const position of ['top-left', 'top-right', 'top-center'] as const) {
      const html = renderToStaticMarkup(createElement(MapOverlay, { position, clearChrome: true }, 'x'))
      expect(classOf(html)).toContain('top-[max(0.75rem,calc(var(--map-mobile-toolbar-height,0px)_+_0.25rem))]')
      expect(classOf(html)).not.toMatch(/(^| )top-3( |$)/)
    }
  })

  it('clears the sheet, safe area and timeline at the bottom, and the corner chrome in corners', () => {
    const positions: MapOverlayPosition[] = ['bottom-left', 'bottom-right', 'bottom-center']
    for (const position of positions) {
      const cls = classOf(renderToStaticMarkup(createElement(MapOverlay, { position, clearChrome: true }, 'x')))
      expect(cls).toContain('var(--map-mobile-sheet-visible-height,0px)_+_var(--map-safe-bottom-offset,0px)')
      expect(cls).toContain('workspace-desktop:bottom-[calc(var(--map-timeline-height,0px)')
      expect(cls).not.toMatch(/(^| )bottom-3( |$)/)
    }
    const left = classOf(
      renderToStaticMarkup(createElement(MapOverlay, { position: 'bottom-left', clearChrome: true })),
    )
    expect(left).toContain('var(--map-legend-stack-height,0px)')
    expect(left).toContain('var(--map-bottom-left-controls-height,0px)')
    const right = classOf(
      renderToStaticMarkup(createElement(MapOverlay, { position: 'bottom-right', clearChrome: true })),
    )
    expect(right).toContain('var(--map-legend-panel-visible-height,0px)')
    const center = classOf(
      renderToStaticMarkup(createElement(MapOverlay, { position: 'bottom-center', clearChrome: true })),
    )
    expect(center).toContain('left-1/2 -translate-x-1/2')
    expect(center).not.toContain('legend')
  })

  it('lets a page override the clearing with its own class', () => {
    const html = renderToStaticMarkup(
      createElement(MapOverlay, { position: 'bottom-left', clearChrome: true, className: 'bottom-6' }),
    )
    expect(classOf(html)).toMatch(/ bottom-6$/)
  })
})

describe('sidebar section', () => {
  it('draws a section unchanged without a variant', () => {
    const html = renderToStaticMarkup(createElement(SidebarSection, { title: 'Layers' }, 'body'))
    expect(classOf(html)).toBe('border-b border-border bg-background/95 p-4')
    expect(html).toContain('<h2')
    const compact = renderToStaticMarkup(
      createElement(MapSidebarShell, { density: 'compact' }, createElement(SidebarSection, { title: 'Layers' }, 'b')),
    )
    expect(compact).toContain('class="border-b border-border bg-background/95 p-3"')
  })

  it('draws a subsection with a hairline above, no rule below, and a level-3 heading', () => {
    for (const density of ['comfortable', 'compact'] as const) {
      const html = renderToStaticMarkup(
        createElement(
          MapSidebarShell,
          { density },
          createElement(SidebarSection, { title: 'Road or viewpoint', variant: 'subsection' }, 'b'),
        ),
      )
      expect(html).toContain('<section class="border-t border-border/60 bg-background/95 px-4 py-3">')
      expect(html).toContain('<h3')
    }
    const level2 = renderToStaticMarkup(
      createElement(SidebarSection, { title: 'Top', variant: 'subsection', headingLevel: 2 }, 'b'),
    )
    expect(level2).toContain('<h2')
  })
})
