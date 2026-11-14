import { describe, expect, it } from 'vitest'
import {
  cleanRampOffsets,
  customRampColorAt,
  customRampColors,
  customRampCss,
  customRampId,
  customRampNameProblem,
  freeCustomRampName,
  isCustomRampId,
  parseCustomRamp,
  parseRampStops,
} from './customRamps.js'

describe('custom colour ramps', () => {
  it('reads colours typed or pasted as hex codes', () => {
    expect(parseRampStops('#FFF, 0a0a0a  #123456')).toEqual(['#ffffff', '#0a0a0a', '#123456'])
    expect(parseRampStops('#fff tomato')).toBeNull()
    expect(parseRampStops('')).toBeNull()
  })

  it('keeps stop positions only when they are a rising path that is not just even spacing', () => {
    expect(cleanRampOffsets([0, 0.2, 1], 3)).toEqual([0, 0.2, 1])
    expect(cleanRampOffsets([0, 0.5, 1], 3)).toBeUndefined()
    expect(cleanRampOffsets([0, 0.8, 0.4], 3)).toBeUndefined()
    expect(cleanRampOffsets([0, 1], 3)).toBeUndefined()
    expect(cleanRampOffsets([0, 2], 2)).toBeUndefined()
  })

  it('samples a ramp to anchors, honouring where each stop sits', () => {
    const even = customRampColors({ stops: ['#000000', '#ffffff'] })
    expect(even).toHaveLength(9)
    expect(even[0]).toBe('#000000')
    expect(even[8]).toBe('#ffffff')
    // A stop pushed early pulls its colour forward: the middle anchor is past it.
    const early = customRampColors({ stops: ['#000000', '#ff0000', '#ffffff'], at: [0, 0.1, 1] })
    expect(early[1]).not.toBe(customRampColors({ stops: ['#000000', '#ff0000', '#ffffff'] })[1])
    // Flat before the first stop and after the last.
    expect(customRampColorAt(['#112233', '#445566'], [0.3, 0.6], 0.1)).toBe('#112233')
    expect(customRampColorAt(['#112233', '#445566'], [0.3, 0.6], 0.9)).toBe('#445566')
    expect(customRampColorAt(['#112233', '#445566'], [0.5, 0.5], 0.5)).toBe('#112233')
  })

  it('draws the editor bar with each stop at its position', () => {
    expect(customRampCss(['#000000', '#ffffff'])).toBe('linear-gradient(to right, #000000 0%, #ffffff 100%)')
    expect(customRampCss(['#000000', '#ff0000', '#ffffff'], [0, 0.25, 1])).toContain('#ff0000 25%')
  })

  it('reads a saved ramp whole or not at all', () => {
    expect(parseCustomRamp({ name: ' Fire ', stops: ['#FF0', '#f00'], at: [0, 1] })).toEqual({
      name: 'Fire',
      stops: ['#ffff00', '#ff0000'],
    })
    expect(parseCustomRamp({ name: 'Skew', stops: ['#000', '#888', '#fff'], at: [0, 0.2, 1] })?.at).toEqual([0, 0.2, 1])
    expect(parseCustomRamp({ name: 'One', stops: ['#000'] })).toBeNull()
    expect(parseCustomRamp({ name: 'Bad', stops: ['#000', 'red'] })).toBeNull()
    expect(parseCustomRamp({ name: '', stops: ['#000', '#fff'] })).toBeNull()
    expect(parseCustomRamp(null)).toBeNull()
  })

  it('names a ramp once, whatever the case, and finds a free name', () => {
    const taken = ['Viridis', 'My gradient']
    expect(customRampNameProblem('viridis', taken)).toBe('A ramp already has that name')
    expect(customRampNameProblem('  ', taken)).toBe('Give the ramp a name')
    expect(customRampNameProblem('My gradient', taken, 'My gradient')).toBeNull()
    expect(customRampNameProblem('Dusk', taken)).toBeNull()
    expect(freeCustomRampName(taken)).toBe('My gradient 2')
    expect(isCustomRampId(customRampId('Dusk'))).toBe(true)
    expect(isCustomRampId('viridis')).toBe(false)
  })
})
