import { describe, expect, it } from 'vitest'
import { syncFeatureState } from './map-feature-state.js'

function recorder() {
  const calls: Array<[string | number | undefined, Record<string, unknown>]> = []
  return {
    calls,
    map: {
      setFeatureState: (feature: { source: string; id?: string | number }, state: Record<string, unknown>) => {
        calls.push([feature.id, state])
      },
    } as never,
  }
}

describe('syncFeatureState', () => {
  it('sets every feature the first time', () => {
    const { map, calls } = recorder()
    syncFeatureState(map, 'regions', undefined, { a: { value: 1 }, b: { value: null } })
    expect(calls).toEqual([
      ['a', { value: 1 }],
      ['b', { value: null }],
    ])
  })

  it('touches only features whose values changed', () => {
    const { map, calls } = recorder()
    syncFeatureState(
      map,
      'regions',
      { a: { value: 1, focused: true }, b: { value: 2 } },
      { a: { value: 1, focused: true }, b: { value: 3 } },
    )
    expect(calls).toEqual([['b', { value: 3 }]])
  })

  it('clears keys and features that are no longer given, leaving other state alone', () => {
    const { map, calls } = recorder()
    syncFeatureState(map, 'regions', { a: { value: 1, focused: true }, b: { value: 2 } }, { a: { value: 1 } })
    expect(calls).toEqual([
      ['b', { value: null }],
      ['a', { focused: null, value: 1 }],
    ])
  })

  it('treats zero as a value distinct from a missing one', () => {
    const { map, calls } = recorder()
    syncFeatureState(map, 'regions', { a: { value: null } }, { a: { value: 0 } })
    expect(calls).toEqual([['a', { value: 0 }]])
  })
})
