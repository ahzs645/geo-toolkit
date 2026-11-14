import { useSyncExternalStore } from 'react'
import { SELECTION_COLOR } from './map-styles.js'

/**
 * The selection highlight as a host theme sees it. `SELECTION_COLOR` is sky-400, and a host that
 * recolours the blue palette families sets `--palette-tint-400` (tailwind-theme.mjs,
 * `themeablePalette`), so a selected feature on the map matches the selected row beside it.
 * MapLibre paint cannot read a CSS variable, so the value is resolved here and handed over as
 * a colour string. `channels` is the variable's value: `r g b`, or empty when no theme sets it.
 */
export function selectionColorFromChannels(channels: string | null | undefined): string {
  const parts = (channels ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return SELECTION_COLOR
  }
  return `rgb(${parts.map((part) => Math.round(part)).join(', ')})`
}

const readThemedSelectionColor = () =>
  typeof document === 'undefined'
    ? SELECTION_COLOR
    : selectionColorFromChannels(getComputedStyle(document.documentElement).getPropertyValue('--palette-tint-400'))

// One observer for every layer: a theme arrives as inline variables, a class or a data attribute
// on the root element. The value is read when that changes, not on every layer render.
const listeners = new Set<() => void>()
let observer: MutationObserver | null = null
let current: string | null = null

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!observer && typeof MutationObserver !== 'undefined') {
    // The theme may have changed while nothing was watching.
    current = readThemedSelectionColor()
    observer = new MutationObserver(() => {
      const next = readThemedSelectionColor()
      if (next === current) return
      current = next
      listeners.forEach((notify) => notify())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-interface-theme'],
    })
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      observer?.disconnect()
      observer = null
      current = null
    }
  }
}

const snapshot = () => (current ??= readThemedSelectionColor())

/**
 * A layer's selection colour: the caller's own when it passes one, else the standard highlight
 * in the host theme's tint. Re-renders the layer when the theme or colour mode changes.
 */
export function useSelectionColor(explicit?: string): string {
  const themed = useSyncExternalStore(subscribe, snapshot, () => SELECTION_COLOR)
  return explicit ?? themed
}
