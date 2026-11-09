import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FileButton } from './file-button.js'

describe('file button', () => {
  it('draws a button and a hidden, named file input that keyboard focus skips', () => {
    const html = renderToStaticMarkup(
      createElement(FileButton, { label: 'Import boundary file', accept: '.geojson', onFiles: () => {} }, 'Import'),
    )
    expect(html).toMatch(/^<button[^>]*type="button"[^>]*>Import<\/button>/)
    expect(html).toContain('aria-label="Import boundary file"')
    expect(html).toContain('accept=".geojson"')
    expect(html).toMatch(/<input[^>]*type="file"[^>]*class="hidden"[^>]*tabindex="-1"/)
  })

  it('disables both the button and its input', () => {
    const html = renderToStaticMarkup(
      createElement(FileButton, { label: 'Import', disabled: true, onFiles: () => {} }, 'Import'),
    )
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })
})
