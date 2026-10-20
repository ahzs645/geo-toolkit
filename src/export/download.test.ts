import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOWNLOAD_URL_LIFETIME_MS, downloadBlob, downloadText } from './download.js'

describe('downloadBlob', () => {
  const anchor = { href: '', download: '', rel: '', style: {}, click: vi.fn(), remove: vi.fn() }
  const revoke = vi.fn()
  const create = vi.fn(() => 'blob:test')
  const appended: unknown[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('document', {
      createElement: () => anchor,
      body: { appendChild: (node: unknown) => appended.push(node) },
    })
    vi.spyOn(URL, 'createObjectURL').mockImplementation(create)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    anchor.click.mockClear()
    revoke.mockClear()
    appended.length = 0
  })

  it('clicks an attached link and revokes its URL only after the browser has read it', () => {
    downloadBlob(new Blob(['x']), 'data.csv')
    expect(appended).toEqual([anchor])
    expect(anchor.download).toBe('data.csv')
    expect(anchor.href).toBe('blob:test')
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(anchor.remove).toHaveBeenCalled()
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DOWNLOAD_URL_LIFETIME_MS)
    expect(revoke).toHaveBeenCalledWith('blob:test')
  })

  it('wraps text in a typed Blob', async () => {
    downloadText('a,b', 'data.csv', 'text/csv')
    const blob = create.mock.calls.at(-1)?.[0] as unknown as Blob
    expect(blob.type).toBe('text/csv')
    expect(await blob.text()).toBe('a,b')
  })
})
