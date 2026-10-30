export type ClipboardStatus = 'idle' | 'pending' | 'copied' | 'failed'

export interface ClipboardWriteOptions {
  /** Supply a transport for an embed, test, or a non-browser host. */
  writeText?: (text: string) => void | Promise<void>
  /** Optional host fallback. Return false or throw when copying still failed. */
  fallback?: (text: string, error: Error) => boolean | void | Promise<boolean | void>
}

const asError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Clipboard access failed.')

/** Copy explicitly: missing clipboard support is a failure, never a successful no-op. */
export async function writeClipboardText(text: string, options: ClipboardWriteOptions = {}): Promise<void> {
  try {
    if (options.writeText) await options.writeText(text)
    else {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText)
        throw new Error('Clipboard access is unavailable. Select the text and use your device’s Copy command.')
      await navigator.clipboard.writeText(text)
    }
  } catch (reason) {
    const error = asError(reason)
    if (!options.fallback || (await options.fallback(text, error)) === false) throw error
  }
}

/** Opt-in legacy fallback for hosts that still support selection copying. */
export function copyTextWithSelection(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const focused = document.activeElement
  const selection = document.getSelection()
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index))
    : []
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  try {
    document.body.appendChild(area)
    area.select()
    return document.execCommand('copy')
  } finally {
    area.remove()
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true })
    if (selection) {
      selection.removeAllRanges()
      for (const range of ranges) selection.addRange(range)
    }
  }
}

export interface ClipboardSnapshot {
  status: ClipboardStatus
  error: Error | null
  text: string | null
}

export interface ClipboardCopyOptions extends ClipboardWriteOptions {
  /** 0 retains feedback until reset or the next copy. Default 1800 ms. */
  resetAfterMs?: number
  /** Failure feedback can remain visible independently. Default 2400 ms. */
  failureResetAfterMs?: number
}

export type ClipboardText = string | (() => string | Promise<string>)

/** Independent state per control; late writes and old timers cannot overwrite a newer attempt. */
export function createClipboardController() {
  let snapshot: ClipboardSnapshot = { status: 'idle', error: null, text: null }
  let generation = 0
  let timeout: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const publish = (next: ClipboardSnapshot) => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const clearTimer = () => {
    if (timeout !== undefined) clearTimeout(timeout)
    timeout = undefined
  }
  const reset = () => {
    generation++
    clearTimer()
    publish({ status: 'idle', error: null, text: null })
  }
  const copy = async (input: ClipboardText, options: ClipboardCopyOptions = {}): Promise<boolean> => {
    const attempt = ++generation
    clearTimer()
    let text: string | null = typeof input === 'string' ? input : null
    publish({ status: 'pending', error: null, text })
    let error: Error | null = null
    try {
      if (typeof input === 'function') text = await input()
      // A newer request or unmount can supersede asynchronous URL generation.
      if (generation !== attempt) return false
      await writeClipboardText(text!, options)
    } catch (reason) {
      error = asError(reason)
    }
    if (generation !== attempt) return false
    publish({ status: error ? 'failed' : 'copied', error, text })
    const delay = error ? (options.failureResetAfterMs ?? 2400) : (options.resetAfterMs ?? 1800)
    if (delay > 0)
      timeout = setTimeout(() => {
        if (generation === attempt) reset()
      }, delay)
    return !error
  }
  return {
    copy,
    reset,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
