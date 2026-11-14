import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCustomRampStore, MAX_CUSTOM_RAMPS } from './custom-ramps.js'

const KEY = 'test:ramps'
const memory = new Map<string, string>()
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
}

describe('custom ramp store', () => {
  beforeEach(() => {
    memory.clear()
    ;(globalThis as { localStorage?: unknown }).localStorage = storage
  })
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('saves, renames in place, removes, and tells its listeners', () => {
    const store = createCustomRampStore(KEY)
    let calls = 0
    const stop = store.subscribe(() => calls++)
    store.save({ name: 'Dusk', stops: ['#000000', '#ffffff'] })
    store.save({ name: 'Fire', stops: ['#ffff00', '#ff0000'], at: [0, 0.3] })
    store.save({ name: 'Dawn', stops: ['#112233', '#ffffff'] }, 'Dusk')
    expect(store.get().map(({ name }) => name)).toEqual(['Dawn', 'Fire'])
    store.remove('Fire')
    expect(store.get()).toEqual([{ name: 'Dawn', stops: ['#112233', '#ffffff'] }])
    expect(calls).toBe(4)
    stop()
    // A second store on the same key reads what the first one kept.
    expect(createCustomRampStore(KEY).get()).toEqual(store.get())
  })

  it('drops damaged entries and duplicates rather than failing, and keeps a bounded list', () => {
    memory.set(
      KEY,
      JSON.stringify([
        { name: 'Good', stops: ['#000', '#fff'] },
        { name: 'Good', stops: ['#111', '#eee'] },
        { name: 'One stop', stops: ['#000'] },
        'nonsense',
      ]),
    )
    expect(createCustomRampStore(KEY).get()).toEqual([{ name: 'Good', stops: ['#000000', '#ffffff'] }])
    memory.set(KEY, '{not json')
    expect(createCustomRampStore(KEY).get()).toEqual([])
    const store = createCustomRampStore(KEY)
    for (let i = 0; i < MAX_CUSTOM_RAMPS + 5; i++) store.save({ name: `Ramp ${i}`, stops: ['#000000', '#ffffff'] })
    expect(store.get()).toHaveLength(MAX_CUSTOM_RAMPS)
  })

  it('keeps ramps for the visit where there is no storage', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage
    const store = createCustomRampStore(KEY)
    store.save({ name: 'Dusk', stops: ['#000000', '#ffffff'] })
    expect(store.get()).toHaveLength(1)
  })
})
