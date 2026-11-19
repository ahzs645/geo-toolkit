import { describe, expect, it } from 'vitest'
import {
  EMPTY_HANDOFF,
  handoffEntries,
  handoffLayerId,
  holdHandoff,
  promoteHandoff,
  requestHandoff,
  type LayerHandoff,
} from './map-layer-handoff.js'

const start = (key: string): LayerHandoff<string> => requestHandoff(EMPTY_HANDOFF, key, `${key}-tiles`)

describe('layer hand-off', () => {
  it('shows the first layer at once, under the caller’s own id', () => {
    const state = start('a')
    expect(state).toEqual({ ...EMPTY_HANDOFF, shown: { key: 'a', slot: 0, value: 'a-tiles' } })
    expect(handoffLayerId('timeline', state.shown!.slot)).toBe('timeline')
  })

  it('keeps the shown layer while the next loads in the other slot, then swaps', () => {
    const loading = requestHandoff(start('a'), 'b', 'b-tiles')
    expect(loading.shown?.key).toBe('a')
    expect(loading.incoming).toEqual({ key: 'b', slot: 1, value: 'b-tiles' })
    const swapped = promoteHandoff(loading, 'b')
    expect(swapped).toEqual({ ...EMPTY_HANDOFF, shown: { key: 'b', slot: 1, value: 'b-tiles' } })
    // The next change goes back to the first slot, so the two layers never share an id.
    expect(requestHandoff(swapped, 'c', 'c-tiles').incoming?.slot).toBe(0)
  })

  it('replaces a release still loading rather than stacking a third layer', () => {
    const b = requestHandoff(start('a'), 'b', 'b-tiles')
    const c = requestHandoff(b, 'c', 'c-tiles')
    expect(c.shown?.key).toBe('a')
    expect(c.incoming).toEqual({ key: 'c', slot: 1, value: 'c-tiles' })
    expect(handoffEntries(c, { key: 'c', value: 'c-tiles' })).toHaveLength(2)
    // A late "loaded" from the dropped release changes nothing.
    expect(promoteHandoff(c, 'b')).toBe(c)
  })

  it('going back to the shown layer drops the one loading', () => {
    const b = requestHandoff(start('a'), 'b', 'b-tiles')
    expect(requestHandoff(b, 'a', 'a-tiles')).toEqual({ ...EMPTY_HANDOFF, shown: b.shown })
  })

  it('once the map has trailed for the time limit, requests wait for the loading layer instead of replacing it', () => {
    const held = holdHandoff(requestHandoff(start('a'), 'b', 'b-tiles'))
    expect(held.holding).toBe(true)
    const c = requestHandoff(held, 'c', 'c-tiles')
    expect(c.incoming?.key).toBe('b')
    expect(c.queued).toEqual({ key: 'c', value: 'c-tiles' })
    // Only the latest waits.
    const d = requestHandoff(c, 'd', 'd-tiles')
    expect(d.queued).toEqual({ key: 'd', value: 'd-tiles' })
    // When b is shown, d starts loading in the slot a leaves, and the map may drop releases again.
    expect(promoteHandoff(d, 'b')).toEqual({
      shown: { key: 'b', slot: 1, value: 'b-tiles' },
      incoming: { key: 'd', slot: 0, value: 'd-tiles' },
      queued: null,
      holding: false,
    })
    // Asking for the loading release again forgets the waiting one.
    expect(requestHandoff(d, 'b', 'b-tiles').queued).toBeNull()
    // Nothing loading, nothing to hold.
    expect(holdHandoff(start('a'))).toEqual(start('a'))
  })

  it('a time limit promotes whatever is loading', () => {
    const b = requestHandoff(start('a'), 'b', 'b-tiles')
    expect(promoteHandoff(b).shown?.key).toBe('b')
    expect(promoteHandoff(start('a'))).toEqual(start('a'))
  })

  it('removes everything at once when the layer is turned off', () => {
    expect(requestHandoff(requestHandoff(start('a'), 'b', ''), null, '')).toBe(EMPTY_HANDOFF)
    expect(requestHandoff(EMPTY_HANDOFF, null, '')).toBe(EMPTY_HANDOFF)
  })

  it('returns the same state when nothing changes, so it can run during render', () => {
    const a = start('a')
    expect(requestHandoff(a, 'a', 'a-tiles')).toBe(a)
    const b = requestHandoff(a, 'b', 'b-tiles')
    expect(requestHandoff(b, 'b', 'b-tiles')).toBe(b)
  })

  it('draws the requested key with its latest value and the outgoing one with its own', () => {
    const b = requestHandoff(start('a'), 'b', 'b-old')
    expect(handoffEntries(b, { key: 'b', value: 'b-new' })).toEqual([
      { key: 'a', slot: 0, value: 'a-tiles', role: 'shown' },
      { key: 'b', slot: 1, value: 'b-new', role: 'incoming' },
    ])
  })
})
