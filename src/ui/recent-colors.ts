import { useSyncExternalStore } from 'react'

/** Most colours kept. */
export const RECENT_COLOR_LIMIT = 8

let recent: readonly string[] = []
const listeners = new Set<() => void>()
const none: readonly string[] = []

/**
 * The colours picked on this page, newest first, shared by every colour field so the colour given
 * to one thing can be given to the next in a click. Kept in memory only: nothing is stored.
 */
export function rememberColor(hex: string): void {
  const next = [hex, ...recent.filter((color) => color !== hex)].slice(0, RECENT_COLOR_LIMIT)
  if (next.length === recent.length && next.every((color, index) => color === recent[index])) return
  recent = next
  for (const listener of listeners) listener()
}

export function recentColors(): readonly string[] {
  return recent
}

/** Forget every colour; for tests. */
export function clearRecentColors(): void {
  recent = []
  for (const listener of listeners) listener()
}

export function useRecentColors(): readonly string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    recentColors,
    () => none,
  )
}
