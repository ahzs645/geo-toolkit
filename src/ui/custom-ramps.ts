import { useSyncExternalStore } from 'react'
import { parseCustomRamp, type CustomRamp } from '../scales/customRamps.js'

/** The most ramps one person keeps. */
export const MAX_CUSTOM_RAMPS = 40

export interface CustomRampStore {
  get: () => readonly CustomRamp[]
  subscribe: (listener: () => void) => () => void
  /** Add a ramp, or replace `editing` (renamed if the name changed) in its place. */
  save: (ramp: CustomRamp, editing?: string) => void
  remove: (name: string) => void
}

/**
 * A person's own colour ramps, kept in this browser under `storageKey` and shared by every ramp
 * picker the host gives the store to. A damaged entry is dropped rather than breaking the list;
 * where storage is unavailable the ramps last for the visit. Another tab's change is picked up.
 */
export function createCustomRampStore(storageKey: string): CustomRampStore {
  const listeners = new Set<() => void>()
  const read = (): readonly CustomRamp[] => {
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) return []
      const names = new Set<string>()
      return parsed.flatMap((entry) => {
        const ramp = parseCustomRamp(entry)
        if (!ramp || names.has(ramp.name) || names.size >= MAX_CUSTOM_RAMPS) return []
        names.add(ramp.name)
        return [ramp]
      })
    } catch {
      return []
    }
  }
  let ramps = read()
  const apply = (next: readonly CustomRamp[], persist: boolean) => {
    ramps = next
    if (persist)
      try {
        localStorage.setItem(storageKey, JSON.stringify(ramps))
      } catch {
        // Private mode or a full store: the ramps are kept for this visit.
      }
    for (const listener of listeners) listener()
  }
  if (typeof window !== 'undefined')
    window.addEventListener('storage', (event) => {
      if (event.key === storageKey) apply(read(), false)
    })
  return {
    get: () => ramps,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    save: (ramp, editing) => {
      const next = [...ramps]
      const slot = editing === undefined ? -1 : next.findIndex(({ name }) => name === editing)
      if (slot >= 0) next[slot] = ramp
      else if (next.length < MAX_CUSTOM_RAMPS) next.push(ramp)
      apply(next, true)
    },
    remove: (name) =>
      apply(
        ramps.filter((ramp) => ramp.name !== name),
        true,
      ),
  }
}

const NONE: readonly CustomRamp[] = []
/** The store's ramps, re-rendering when one is saved or removed. */
export function useCustomRamps(store: CustomRampStore): readonly CustomRamp[] {
  return useSyncExternalStore(store.subscribe, store.get, () => NONE)
}
