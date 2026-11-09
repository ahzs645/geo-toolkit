import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  status: 'unavailable',
  setRTLTextPlugin: vi.fn(),
}))

vi.mock('maplibre-gl', () => ({
  getRTLTextPluginStatus: () => runtime.status,
  setRTLTextPlugin: runtime.setRTLTextPlugin,
}))

const { DEFAULT_RTL_TEXT_PLUGIN_URL, ensureRtlTextPlugin } = await import('./map-rtl-text.js')

describe('ensureRtlTextPlugin', () => {
  beforeEach(() => {
    runtime.status = 'unavailable'
    runtime.setRTLTextPlugin.mockReset().mockImplementation(() => {
      runtime.status = 'deferred'
      return Promise.resolve()
    })
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', { baseURI: 'https://example.org/atlas/index.html' })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('registers the pinned plugin lazily by default', () => {
    ensureRtlTextPlugin()
    expect(runtime.setRTLTextPlugin).toHaveBeenCalledWith(DEFAULT_RTL_TEXT_PLUGIN_URL, true)
  })

  it('resolves a self-hosted relative URL against the page', () => {
    ensureRtlTextPlugin('./vendor/rtl.js')
    expect(runtime.setRTLTextPlugin).toHaveBeenCalledWith('https://example.org/atlas/vendor/rtl.js', true)
  })

  it('registers only once per page, and not over a host registration', () => {
    ensureRtlTextPlugin()
    ensureRtlTextPlugin('https://other.example/rtl.js')
    expect(runtime.setRTLTextPlugin).toHaveBeenCalledTimes(1)
    runtime.status = 'loaded'
    runtime.setRTLTextPlugin.mockClear()
    ensureRtlTextPlugin()
    expect(runtime.setRTLTextPlugin).not.toHaveBeenCalled()
  })

  it('does nothing without a browser', () => {
    vi.stubGlobal('window', undefined)
    ensureRtlTextPlugin()
    expect(runtime.setRTLTextPlugin).not.toHaveBeenCalled()
  })

  it('warns instead of throwing when the plugin fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runtime.setRTLTextPlugin.mockImplementation(() => Promise.reject(new Error('offline')))
    ensureRtlTextPlugin()
    await Promise.resolve()
    await Promise.resolve()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
