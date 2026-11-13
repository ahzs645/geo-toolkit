import { expect, test } from '@playwright/test'

/**
 * Each pair is the slot's height and the plot's, read in a ResizeObserver callback registered after the
 * viewport's own: the browser runs it in the same delivery, after layout and before paint, so it sees exactly
 * what the next frame draws.
 */
const watchPaintedHeights = () => {
  const viewport = document.querySelector<HTMLElement>('.viewport')!
  const plot = document.querySelector<HTMLElement>('[data-testid="plot"]')!
  const pairs: [number, number][] = []
  ;(window as unknown as { painted: typeof pairs }).painted = pairs
  new ResizeObserver(() =>
    pairs.push([Math.floor(viewport.getBoundingClientRect().height), plot.getBoundingClientRect().height]),
  ).observe(viewport)
}

test('a sibling folding open or shut under the chart never paints the plot at the old height', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  // Every frame's plot height from the first frame that has one: animation frame callbacks run before paint.
  await page.addInitScript(() => {
    const frames: number[] = []
    ;(window as unknown as { frames: number[] }).frames = frames
    const read = () => {
      const plot = document.querySelector<HTMLElement>('[data-testid="plot"]')
      if (plot) frames.push(plot.getBoundingClientRect().height)
      if (frames.length < 10) requestAnimationFrame(read)
    }
    requestAnimationFrame(read)
  })
  await page.goto('/tests/fixtures/chart-viewport.html')
  const plot = page.getByTestId('plot')
  await expect(plot).toHaveCSS('height', '300px')
  // Measured before the first paint, never drawn at `initialHeight` first.
  await expect.poll(() => page.evaluate(() => (window as unknown as { frames: number[] }).frames.length)).toBe(10)
  expect(await page.evaluate(() => (window as unknown as { frames: number[] }).frames)).toEqual(Array(10).fill(300))
  await page.evaluate(watchPaintedHeights)
  const toggle = page.getByRole('button', { name: 'Details below chart', exact: true })
  for (const expected of [180, 300, 180, 300]) {
    await toggle.click()
    await expect(plot).toHaveCSS('height', `${expected}px`)
  }
  const painted = await page.evaluate(() => (window as unknown as { painted: [number, number][] }).painted)
  // The initial observation plus one per toggle; every one already has the plot at the slot's height.
  expect(painted.length).toBeGreaterThanOrEqual(5)
  for (const [slot, drawn] of painted) expect(drawn).toBe(slot)
  expect(errors).toEqual([])
})
