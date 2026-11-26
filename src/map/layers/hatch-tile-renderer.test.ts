import { describe, expect, it } from 'vitest'
import { organicHatchRecipe } from '../../patterns/recipe.js'
import { mercatorUnit } from '../../patterns/hatch-tiles.js'
import { createHatchTileRenderer } from './hatch-tile-renderer.js'

const land = [
  [
    [-124, 50],
    [-120, 50],
    [-120, 54],
    [-124, 54],
  ] as [number, number][],
]

describe('hatch tile renderer without a worker', () => {
  it('draws a tile of the areas sent, and drops a tile aborted while it waits', async () => {
    const renderer = createHatchTileRenderer(null)
    renderer.setAreas('a', { land })
    const [u, v] = mercatorUnit(-122, 52)
    const job = {
      areas: 'a',
      recipe: organicHatchRecipe({ style: 'patch' }),
      anchor: [-125, 55] as [number, number],
      z: 6,
      x: Math.floor(u * 64),
      y: Math.floor(v * 64),
      tileSize: 256,
      pixelRatio: 1,
    }
    const image = await renderer.render(job)
    expect(image?.width).toBe(256)
    const abort = new AbortController()
    const dropped = renderer.render(job, abort.signal)
    abort.abort()
    await expect(dropped).rejects.toMatchObject({ name: 'AbortError' })
    renderer.dropAreas('a')
    expect(await renderer.render(job)).toBeNull()
    renderer.dispose()
  })
})
