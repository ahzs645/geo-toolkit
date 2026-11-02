import { describe, expect, it } from 'vitest'
import { mapCornerTargets, publishMapCornerHeights } from './map-corners.js'

type Rect = { top: number; bottom: number; height: number }

const rect = (top: number, bottom: number): Rect => ({ top, bottom, height: bottom - top })

function fakeElement({
  box = rect(0, 0),
  children = [] as { getBoundingClientRect: () => Rect }[],
  dataset = {} as Record<string, string>,
  classes = [] as string[],
  parentElement = null as unknown,
} = {}) {
  const style = new Map<string, string>()
  return {
    getBoundingClientRect: () => box,
    children,
    dataset,
    parentElement,
    classList: { contains: (name: string) => classes.includes(name) },
    style: {
      setProperty: (name: string, value: string) => style.set(name, value),
      removeProperty: (name: string) => style.delete(name),
      values: style,
    },
  }
}

describe('publishMapCornerHeights', () => {
  it('measures from the highest control, not the corner box with the attribution margin', () => {
    // MapLibre's compact attribution: 24px tall with a 10px margin all round,
    // so the corner box is 44px but the attribution reaches 34px up.
    const right = fakeElement({ box: rect(856, 900), children: [{ getBoundingClientRect: () => rect(866, 890) }] })
    const left = fakeElement({ box: rect(900, 900) })
    const container = {
      querySelector: (selector: string) => (selector.endsWith('bottom-right') ? right : left),
    }
    const target = fakeElement()

    const cleanup = publishMapCornerHeights(container as never, [target as never])
    expect(target.style.values.get('--map-bottom-right-controls-height')).toBe('34px')
    expect(target.style.values.get('--map-bottom-left-controls-height')).toBe('0px')

    cleanup()
    expect(target.style.values.size).toBe(0)
  })

  it('skips hidden controls and treats a missing corner as empty', () => {
    const right = fakeElement({
      box: rect(860, 900),
      children: [{ getBoundingClientRect: () => rect(0, 0) }, { getBoundingClientRect: () => rect(870, 890) }],
    })
    const container = { querySelector: (selector: string) => (selector.endsWith('bottom-right') ? right : null) }
    const target = fakeElement()

    publishMapCornerHeights(container as never, [target as never])
    expect(target.style.values.get('--map-bottom-right-controls-height')).toBe('30px')
    expect(target.style.values.get('--map-bottom-left-controls-height')).toBe('0px')
  })
})

describe('mapCornerTargets', () => {
  it('collects every layout root up to the workspace, so a legend beside the map sees the heights', () => {
    const outside = fakeElement({ dataset: { mapLayoutRoot: 'true' } })
    const workspace = fakeElement({ classes: ['geo-toolkit'], parentElement: outside })
    const layout = fakeElement({ dataset: { mapLayoutRoot: 'true' }, parentElement: workspace })
    const wrapper = fakeElement({ parentElement: layout })
    const map = fakeElement({ dataset: { mapLayoutRoot: 'true' }, parentElement: wrapper })

    expect(mapCornerTargets(map as never)).toEqual([map, layout])
  })
})
