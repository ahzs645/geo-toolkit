import { describe, expect, it } from 'vitest'
import { imageSourceTakesPixels } from './image-pixels.js'

describe('imageSourceTakesPixels', () => {
  it('is true from MapLibre 6.18', () => {
    expect(imageSourceTakesPixels('6.18.0')).toBe(true)
    expect(imageSourceTakesPixels('6.19.2')).toBe(true)
    expect(imageSourceTakesPixels('7.0.0-pre.1')).toBe(true)
  })

  it('is false before it, and for a version that cannot be read', () => {
    expect(imageSourceTakesPixels('6.17.9')).toBe(false)
    expect(imageSourceTakesPixels('5.15.0')).toBe(false)
    expect(imageSourceTakesPixels(undefined)).toBe(false)
    expect(imageSourceTakesPixels('')).toBe(false)
  })
})
