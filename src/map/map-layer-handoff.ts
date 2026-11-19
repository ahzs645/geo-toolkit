/**
 * The rule behind handing one map layer over to the next (`map-raster-handoff.tsx`): the layer on
 * show stays until the one replacing it has its tiles, so a change of source never blanks the map.
 * DOM-free, so it is tested without a map; the time limits are timers in the hook.
 *
 * At most two layers are mounted: the one shown and the one loading. A request that arrives while
 * another is loading takes its place, so a timeline played faster than its tiles arrive drops
 * releases rather than stacking them. Once the map has trailed the request for the time limit
 * (`holding`), requests wait instead, unmounted, so the loading layer can finish and the map moves on.
 */

/**
 * The time limit, used twice: a layer still loading after it is shown as it stands (its tiles
 * never came), and a map that has shown an old layer for this long stops dropping the loading one.
 */
export const LAYER_HANDOFF_TIME_LIMIT_MS = 4_000

/** A hand-off shorter than this says nothing (`MapHandoffNote`): a note that flashes for a quick swap is noise. */
export const HANDOFF_NOTE_DELAY_MS = 400

/** The two layer ids a hand-off alternates between, so the outgoing and incoming layers never share one. */
export type HandoffSlot = 0 | 1

export interface HandoffEntry<T> {
  key: string
  slot: HandoffSlot
  value: T
}

export interface LayerHandoff<T> {
  /** Drawn at full opacity. */
  shown: HandoffEntry<T> | null
  /** Mounted and loading its tiles, drawn at opacity 0 until it is shown. */
  incoming: HandoffEntry<T> | null
  /** The latest request made while `holding`: not mounted, it loads once the incoming layer is shown. */
  queued: { key: string; value: T } | null
  /** The shown layer has trailed the request for the time limit: requests wait rather than replace. */
  holding: boolean
}

export const EMPTY_HANDOFF: LayerHandoff<never> = { shown: null, incoming: null, queued: null, holding: false }

const otherSlot = (slot: HandoffSlot): HandoffSlot => (slot === 0 ? 1 : 0)

/**
 * The hand-off after a request for `key` (null: the layer is off, and everything goes at once).
 * Returns the same object when nothing changes, so it can run during render.
 */
export function requestHandoff<T>(state: LayerHandoff<T>, key: string | null, value: T): LayerHandoff<T> {
  if (key === null) return state.shown || state.incoming ? EMPTY_HANDOFF : state
  if (!state.shown) return { ...EMPTY_HANDOFF, shown: { key, slot: 0, value } }
  if (key === state.shown.key) return state.incoming ? { ...EMPTY_HANDOFF, shown: state.shown } : state
  if (key === state.incoming?.key) return state.queued ? { ...state, queued: null } : state
  if (state.holding && state.incoming) return key === state.queued?.key ? state : { ...state, queued: { key, value } }
  return { ...state, incoming: { key, slot: otherSlot(state.shown.slot), value } }
}

/**
 * The incoming layer has its tiles, or its time is up: it is shown and the outgoing one removed.
 * A request that waited starts loading in the freed slot. `key` guards against a late report
 * from a layer that has since been replaced.
 */
export function promoteHandoff<T>(state: LayerHandoff<T>, key?: string): LayerHandoff<T> {
  const { incoming, queued } = state
  if (!incoming || (key !== undefined && key !== incoming.key)) return state
  return {
    shown: incoming,
    incoming: queued && queued.key !== incoming.key ? { ...queued, slot: otherSlot(incoming.slot) } : null,
    queued: null,
    holding: false,
  }
}

/** The map has trailed the request for the time limit: from now on requests wait for the loading layer. */
export function holdHandoff<T>(state: LayerHandoff<T>): LayerHandoff<T> {
  return state.incoming && !state.holding ? { ...state, holding: true } : state
}

/** The layer id of a slot: the first layer shown keeps the caller's own id. */
export function handoffLayerId(id: string, slot: HandoffSlot): string {
  return slot === 0 ? id : `${id}-handoff`
}

/** The entries to mount, the shown one first, with the latest value for the requested key. */
export function handoffEntries<T>(
  state: LayerHandoff<T>,
  requested: { key: string; value: T } | null,
): Array<HandoffEntry<T> & { role: 'shown' | 'incoming' }> {
  const fresh = (entry: HandoffEntry<T>) =>
    requested && entry.key === requested.key ? { ...entry, value: requested.value } : entry
  return [
    ...(state.shown ? [{ ...fresh(state.shown), role: 'shown' as const }] : []),
    ...(state.incoming ? [{ ...fresh(state.incoming), role: 'incoming' as const }] : []),
  ]
}
