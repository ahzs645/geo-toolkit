import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useClipboardText } from './use-clipboard-text.js'
import type { ClipboardCopyOptions, ClipboardText, ClipboardSnapshot } from './clipboard-text.js'

export interface CopyButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> {
  text: ClipboardText
  children?: ReactNode
  pendingLabel?: ReactNode
  copiedLabel?: ReactNode
  failedLabel?: ReactNode
  options?: ClipboardCopyOptions
  /** Render host-specific manual-copy UI or notices after the result. */
  onResult?: (result: { copied: boolean; text: string | null }) => void
  renderLabel?: (state: ClipboardSnapshot) => ReactNode
}

export function CopyButton({
  text,
  children = 'Copy',
  pendingLabel = 'Copying…',
  copiedLabel = 'Copied',
  failedLabel = 'Copy failed',
  options,
  onResult,
  renderLabel,
  disabled,
  type = 'button',
  ...props
}: CopyButtonProps) {
  const clipboard = useClipboardText(options)
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )
  const label =
    renderLabel?.(clipboard) ??
    (clipboard.status === 'pending'
      ? pendingLabel
      : clipboard.status === 'copied'
        ? copiedLabel
        : clipboard.status === 'failed'
          ? failedLabel
          : children)
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || clipboard.status === 'pending'}
      aria-live="polite"
      aria-busy={clipboard.status === 'pending'}
      onClick={async () => {
        const attempt = ++generation.current
        // Keep the generated value for a caller's manual-copy fallback.
        let resolved: string | null = typeof text === 'string' ? text : null
        const copied = await clipboard.copy(typeof text === 'string' ? text : async () => (resolved = await text()))
        if (generation.current === attempt) onResult?.({ copied, text: resolved })
      }}
    >
      {label}
    </button>
  )
}
