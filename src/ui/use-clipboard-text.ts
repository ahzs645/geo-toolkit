import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createClipboardController, type ClipboardCopyOptions, type ClipboardText } from './clipboard-text.js'

export function useClipboardText(options: ClipboardCopyOptions = {}) {
  const [controller] = useState(createClipboardController)
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => () => controller.reset(), [controller])
  const { writeText, fallback, resetAfterMs, failureResetAfterMs } = options
  const copy = useCallback(
    (text: ClipboardText) => controller.copy(text, { writeText, fallback, resetAfterMs, failureResetAfterMs }),
    [controller, writeText, fallback, resetAfterMs, failureResetAfterMs],
  )
  return { ...snapshot, copy, reset: controller.reset }
}
