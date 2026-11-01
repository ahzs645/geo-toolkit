import { expect, test, type Page } from '@playwright/test'

const fixture = '/tests/fixtures/workspace-motion.html'
const desktop = { viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' as const }
const probe: [number, number] = [-122.75, 53.915]

async function ready(page: Page) {
  await page.goto(fixture)
  await expect(page.getByTestId('map-state')).toHaveAttribute('data-loaded', 'true')
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
}

/** Toggle the table and record the canvas and the probe's screen position on every frame until it settles. */
function recordTableTransition(page: Page) {
  return page.evaluate(async (probe) => {
    const map = window.__motionMap!
    const canvas = map.getCanvas()
    const pane = () => document.querySelector('.geo-map-layout-bottom-pane')
    const toggle = [...document.querySelectorAll<HTMLButtonElement>('nav button')].find(
      (button) => button.textContent === 'Toggle table',
    )!
    const frames: Array<{ width: number; height: number; x: number; y: number }> = []
    const sample = () => {
      const point = map.project(probe)
      frames.push({ width: canvas.width, height: canvas.height, x: point.x, y: point.y })
    }
    sample()
    toggle.click()
    let stable = 0
    for (let frame = 0; frame < 120 && stable < 6; frame++) {
      await new Promise(requestAnimationFrame)
      sample()
      const running = pane()
        ?.closest('[data-map-layout-root="true"]')
        ?.getAnimations({ subtree: true })
        .some((animation) => animation.playState === 'running')
      stable = running ? 0 : stable + 1
    }
    return frames
  }, probe)
}

test('the docked table slides over a still map instead of resizing its canvas', async ({ browser }) => {
  const context = await browser.newContext(desktop)
  const page = await context.newPage()
  try {
    await ready(page)
    const before = await page.evaluate(() => window.__motionMap!.getCenter().toArray())

    for (const frames of [await recordTableTransition(page), await recordTableTransition(page)]) {
      expect(frames.length).toBeGreaterThan(8)
      // No frame reallocates (and so clears) the WebGL drawing buffer.
      expect(new Set(frames.map((frame) => `${frame.width}x${frame.height}`)).size).toBe(1)
      // The picture does not move while the pane travels over it.
      for (const frame of frames) {
        expect(Math.abs(frame.x - frames[0].x)).toBeLessThan(0.5)
        expect(Math.abs(frame.y - frames[0].y)).toBeLessThan(0.5)
      }
    }

    // Closing restores the exact camera and padding it started with.
    const after = await page.evaluate(() => ({
      center: window.__motionMap!.getCenter().toArray(),
      padding: window.__motionMap!.getPadding().bottom,
    }))
    expect(after.padding).toBe(0)
    expect(after.center[0]).toBeCloseTo(before[0], 9)
    expect(after.center[1]).toBeCloseTo(before[1], 9)
  } finally {
    await context.close()
  }
})

test('map chrome and selections stay in the part of the map the table leaves visible', async ({ browser }) => {
  const context = await browser.newContext(desktop)
  const page = await context.newPage()
  try {
    await ready(page)
    await page.getByRole('button', { name: 'Toggle table', exact: true }).click()
    const pane = page.locator('.geo-map-layout-bottom-pane')
    await expect
      .poll(() =>
        page.evaluate(() => {
          const map = window.__motionMap!
          const paneTop = document.querySelector('.geo-map-layout-bottom-pane')!.getBoundingClientRect().top
          const chrome = map.getContainer().querySelector('.geo-map-chrome')!.getBoundingClientRect()
          const content = document.querySelector('[data-map-content="true"]')!.getBoundingClientRect()
          return {
            chromeMeetsPane: Math.abs(chrome.bottom - paneTop) < 1,
            contentMeetsPane: Math.abs(content.bottom - paneTop) < 1,
            padding: map.getPadding().bottom,
            canvasUnderPane: map.getContainer().getBoundingClientRect().bottom > paneTop + 150,
          }
        }),
      )
      .toEqual({ chromeMeetsPane: true, contentMeetsPane: true, padding: 160, canvasUnderPane: true })
    await expect(pane.getByLabel('Table note', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Select B', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const map = window.__motionMap!
          const point = map.project([-122.65, 53.945])
          const canvasTop = map.getContainer().getBoundingClientRect().top
          const paneTop = document.querySelector('.geo-map-layout-bottom-pane')!.getBoundingClientRect().top
          return !map.isMoving() && point.y > 12 && point.y + canvasTop < paneTop - 12
        }),
      )
      .toBe(true)
  } finally {
    await context.close()
  }
})

test('every map resize is redrawn before the frame is presented', async ({ browser }) => {
  const context = await browser.newContext(desktop)
  const page = await context.newPage()
  try {
    await ready(page)
    const result = await page.evaluate(async () => {
      const map = window.__motionMap!
      let frame = 0
      let running = true
      const tick = () => {
        frame++
        if (running) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      let pending: number | null = null
      let resizes = 0
      let late = 0
      const onResize = () => {
        resizes++
        pending = frame
      }
      const onRender = () => {
        if (pending === null) return
        if (pending !== frame) late++
        pending = null
      }
      map.on('resize', onResize)
      map.on('render', onRender)
      // The sidebar's width transition reshapes the map on every frame.
      document.querySelector<HTMLButtonElement>('button[aria-label="Hide sidebar"]')!.click()
      for (let index = 0; index < 40; index++) await new Promise(requestAnimationFrame)
      document.querySelector<HTMLButtonElement>('button[aria-label="Show sidebar"]')!.click()
      for (let index = 0; index < 40; index++) await new Promise(requestAnimationFrame)
      running = false
      map.off('resize', onResize)
      map.off('render', onRender)
      return { resizes, late, unrendered: pending !== null }
    })
    expect(result.resizes).toBeGreaterThan(4)
    expect(result.late).toBe(0)
    expect(result.unrendered).toBe(false)
  } finally {
    await context.close()
  }
})
