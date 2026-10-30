import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClipboardController, writeClipboardText } from './clipboard-text.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('clipboard transport', () => {
  it('rejects absent clipboard support instead of announcing success', async () => {
    vi.stubGlobal('navigator', {})
    await expect(writeClipboardText('link')).rejects.toThrow('Clipboard access is unavailable')
  })

  it('passes original text and denial to a host fallback, rejecting a failed fallback', async () => {
    const denial = new Error('denied')
    const writeText = vi.fn().mockRejectedValue(denial)
    const fallback = vi.fn().mockReturnValue(true)
    await writeClipboardText('original\trows\n', { writeText, fallback })
    expect(fallback).toHaveBeenCalledWith('original\trows\n', denial)
    await expect(writeClipboardText('link', { writeText, fallback: () => false })).rejects.toBe(denial)
  })
})

describe('clipboard control lifecycle', () => {
  it('clears feedback with one timer and cancels it on reset/unmount', async () => {
    vi.useFakeTimers()
    const control = createClipboardController()
    await control.copy('one', { writeText: vi.fn(), resetAfterMs: 1000 })
    expect(control.getSnapshot().status).toBe('copied')
    expect(vi.getTimerCount()).toBe(1)
    control.reset()
    expect(vi.getTimerCount()).toBe(0)
    expect(control.getSnapshot().status).toBe('idle')
    await control.copy('two', { writeText: vi.fn(), resetAfterMs: 1000 })
    vi.advanceTimersByTime(1000)
    expect(control.getSnapshot().status).toBe('idle')
  })

  it('retains text and failure when clipboard is denied', async () => {
    const control = createClipboardController()
    expect(
      await control.copy('manual link', {
        writeText: () => Promise.reject(new Error('denied')),
        failureResetAfterMs: 0,
      }),
    ).toBe(false)
    expect(control.getSnapshot()).toMatchObject({ status: 'failed', text: 'manual link', error: expect.any(Error) })
  })

  it('ignores an older write after a later attempt finishes', async () => {
    const control = createClipboardController()
    let finish!: () => void
    const old = control.copy('old', {
      writeText: () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
      resetAfterMs: 0,
    })
    expect(control.getSnapshot().status).toBe('pending')
    await control.copy('new', { writeText: vi.fn(), resetAfterMs: 0 })
    finish()
    expect(await old).toBe(false)
    expect(control.getSnapshot()).toMatchObject({ status: 'copied', text: 'new' })
  })

  it('does not write a URL if its generation was superseded or reset', async () => {
    const control = createClipboardController()
    let finish!: (text: string) => void
    const writeText = vi.fn()
    const old = control.copy(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
      { writeText },
    )
    control.reset()
    finish('obsolete URL')
    expect(await old).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
    expect(control.getSnapshot().status).toBe('idle')
  })
})
