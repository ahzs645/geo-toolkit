import { describe, expect, it } from 'vitest'
import { measureElementSize } from './use-element-size.js'
import { nextFold, type FoldThresholds } from './use-size-fold.js'

describe('size folds', () => {
  const chart: FoldThresholds = { foldBelow: 260, unfoldFrom: 284 }

  it('folds below one size and unfolds only from a larger one', () => {
    expect(nextFold(false, 258, chart)).toBe(true)
    expect(nextFold(true, 274, chart)).toBe(true)
    expect(nextFold(true, 284, chart)).toBe(false)
    expect(nextFold(false, 274, chart)).toBe(false)
  })

  // A fold that gives back 16 px when it folds would otherwise flip every render.
  it('settles where folding changes the size it was measured on', () => {
    let folded = false
    const seen: boolean[] = []
    for (let frame = 0; frame < 6; frame++) {
      folded = nextFold(folded, folded ? 274 : 258, chart)
      seen.push(folded)
    }
    expect(seen).toEqual([true, true, true, true, true, true])
  })

  it('keeps its state while the size is unmeasured or hidden', () => {
    expect(nextFold(true, 0, chart)).toBe(true)
    expect(nextFold(false, Number.NaN, chart)).toBe(false)
  })

  it('refuses a fold that would unfold below where it folds', () => {
    expect(() => nextFold(false, 100, { foldBelow: 260, unfoldFrom: 250 })).toThrow('must unfold at or above')
  })
})

describe('measured sizes', () => {
  it('reads the box an element takes on screen', () => {
    const element = { getBoundingClientRect: () => ({ width: 320.5, height: 200 }) } as unknown as Element
    expect(measureElementSize(element)).toEqual({ width: 320.5, height: 200 })
    expect(measureElementSize(element, 'content')).toEqual({ width: 320.5, height: 200 })
  })
})
