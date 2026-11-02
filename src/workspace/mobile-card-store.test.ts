import { describe, expect, it, vi } from 'vitest'
import { CONTROLS_STACK_ID, createMobileCardStack, mobileCardStackView } from './mobile-card-store.js'

describe('workspace card isolation', () => {
  it('allows the same feature/table identities independently across embedded maps', () => {
    const first = createMobileCardStack()
    const second = createMobileCardStack()
    const secondChanged = vi.fn()
    second.subscribe(secondChanged)
    second.push('feature')
    second.setHeight('feature', 200)
    secondChanged.mockClear()
    first.push('feature')
    first.push('table')
    first.setHeight('table', 400)
    first.push('feature')
    first.remove('feature')
    expect(first.getSnapshot()).toEqual([{ id: 'table', visibleHeight: 400 }])
    expect(second.getSnapshot()).toEqual([{ id: 'feature', visibleHeight: 200 }])
    expect(secondChanged).not.toHaveBeenCalled()
    first.reset()
    expect(second.getSnapshot()).toHaveLength(1)
  })
  it('preserves a promoted card height and releases subscriptions on unmount', () => {
    const store = createMobileCardStack()
    const changed = vi.fn()
    const unsubscribe = store.subscribe(changed)
    store.push('feature')
    store.setHeight('feature', 280)
    store.push('table')
    store.push('feature')
    expect(store.getSnapshot()).toEqual([
      { id: 'table', visibleHeight: 0 },
      { id: 'feature', visibleHeight: 280 },
    ])
    unsubscribe()
    changed.mockClear()
    store.remove('feature')
    expect(changed).not.toHaveBeenCalled()
  })
})

describe('one sheet stack for the controls sheet and every card', () => {
  const view = (store: ReturnType<typeof createMobileCardStack>, id: string) =>
    mobileCardStackView(store.getSnapshot(), id)

  it('derives controls-in-front from the order, so a newer card replaces it', () => {
    const store = createMobileCardStack()
    store.sendToBack(CONTROLS_STACK_ID)
    store.push('feature')
    store.setHeight('feature', 300)
    store.push(CONTROLS_STACK_ID)
    expect(view(store, 'feature')).toMatchObject({ controlsInFront: true, isFrontCard: true, cardDepth: 0 })
    // Opening the table from the controls puts it in front; the feature card is
    // now simply the card behind it, not still "behind the controls".
    store.push('table')
    store.setHeight('table', 320)
    store.sendToBack(CONTROLS_STACK_ID)
    expect(view(store, 'feature')).toEqual({
      depth: 1,
      cardDepth: 1,
      isFrontCard: false,
      controlsInFront: false,
      hasCardsBehind: true,
      frontCardVisibleHeight: 320,
    })
    expect(view(store, 'table')).toMatchObject({
      isFrontCard: true,
      hasCardsBehind: true,
      frontCardVisibleHeight: null,
    })
  })

  it('swaps the front card without disturbing the controls sheet at the back', () => {
    const store = createMobileCardStack()
    store.sendToBack(CONTROLS_STACK_ID)
    store.push('feature')
    store.push('table')
    store.push('feature')
    expect(store.getSnapshot().map((entry) => entry.id)).toEqual([CONTROLS_STACK_ID, 'table', 'feature'])
    expect(view(store, 'table')).toMatchObject({ cardDepth: 1, controlsInFront: false })
  })

  it('does not count the controls sheet as in front when there is no card', () => {
    const store = createMobileCardStack()
    store.push(CONTROLS_STACK_ID)
    expect(view(store, CONTROLS_STACK_ID).controlsInFront).toBe(false)
  })

  it('leaves the order alone, without notifying, when nothing moves', () => {
    const store = createMobileCardStack()
    store.push('feature')
    store.sendToBack(CONTROLS_STACK_ID)
    const changed = vi.fn()
    store.subscribe(changed)
    store.push('feature')
    store.sendToBack(CONTROLS_STACK_ID)
    expect(changed).not.toHaveBeenCalled()
  })
})
