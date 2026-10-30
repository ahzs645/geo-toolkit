import { describe, expect, it } from 'vitest'
import { featureCardHeights, resolveFeatureCardSnap, stepFeatureCard } from './feature-card-math.js'

describe('feature card detents', () => {
  it('keeps the authored compact height within the available viewport', () => {
    expect(featureCardHeights(720, 300, 92)).toEqual({ full: 720, half: 300, collapsed: 92 })
    expect(featureCardHeights(240, 300, 92)).toEqual({ full: 240, half: 240, collapsed: 92 })
    expect(featureCardHeights(70, 300, 92)).toEqual({ full: 70, half: 70, collapsed: 70 })
  })

  it('settles from the rendered position and biases the result by swipe velocity', () => {
    const heights = featureCardHeights(720, 300, 92)
    expect(resolveFeatureCardSnap(470, 0, heights)).toBe('half')
    expect(resolveFeatureCardSnap(470, -0.8, heights)).toBe('full')
    expect(resolveFeatureCardSnap(470, 1.5, heights)).toBe('collapsed')
    expect(resolveFeatureCardSnap(100, 0, heights)).toBe('collapsed')
  })

  it('provides all detents without a drag and ignores unrelated keys', () => {
    expect(stepFeatureCard('collapsed', 'ArrowUp')).toBe('half')
    expect(stepFeatureCard('half', 'ArrowUp')).toBe('full')
    expect(stepFeatureCard('full', 'ArrowDown')).toBe('half')
    expect(stepFeatureCard('collapsed', 'Home')).toBe('collapsed')
    expect(stepFeatureCard('collapsed', 'End')).toBe('full')
    expect(stepFeatureCard('full', ' ')).toBe('collapsed')
    expect(stepFeatureCard('full', 'Tab')).toBeUndefined()
  })
})
