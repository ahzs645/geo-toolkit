import { expect, test } from '@playwright/test'

test('the map timeline scrubs, steps, plays from the end and stacks the legend above it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/timeline')
  const timeline = page.locator('[data-map-timeline]')
  const slider = page.getByRole('slider', { name: 'Sightings timeline', exact: true })
  await expect(timeline).toHaveAttribute('data-density', 'full')
  await expect(slider).toHaveAttribute('aria-valuetext', 'Oct 2025 – Dec 2025')

  await slider.focus()
  await page.keyboard.press('Home')
  await expect(slider).toHaveAttribute('aria-valuetext', 'Jan 2019')
  await page.keyboard.press('PageUp')
  await expect(slider).toHaveAttribute('aria-valuetext', 'Nov 2019 – Jan 2020')
  await page.keyboard.press('End')

  // Play from the last bucket starts over instead of stopping a tick later.
  await timeline.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(slider).toHaveAttribute('aria-valuenow', /^[12]$/, { timeout: 3_000 })
  await timeline.getByRole('button', { name: 'Pause', exact: true }).click()

  // Dragging only moves forward when the pointer does.
  const box = (await slider.boundingBox())!
  await page.mouse.move(box.x + 5, box.y + box.height / 2)
  await page.mouse.down()
  const seen: number[] = []
  for (let f = 0.1; f <= 0.9; f += 0.2) {
    await page.mouse.move(box.x + box.width * f, box.y + box.height / 2)
    seen.push(Number(await slider.getAttribute('aria-valuenow')))
  }
  await page.mouse.up()
  expect(seen).toEqual([...seen].sort((a, b) => a - b))

  await timeline.getByRole('group', { name: 'Window' }).getByRole('button', { name: 'Cumul.' }).click()
  await expect(slider).toHaveAttribute('aria-valuetext', /^Through /)

  const legend = (await page.locator('[data-map-legend-panel]').boundingBox())!
  const panel = (await timeline.boundingBox())!
  expect(legend.y + legend.height).toBeLessThanOrEqual(panel.y)

  // The attribution holds the corner under the legend, so opening one moves nothing below it.
  const attribution = (await page.locator('.maplibregl-ctrl-attrib').boundingBox())!
  expect(legend.y + legend.height).toBeLessThanOrEqual(attribution.y)
  expect(attribution.y + attribution.height).toBeLessThanOrEqual(panel.y)
})

test('the map timeline reads out a change only for a one-bucket window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/timeline')
  const timeline = page.locator('[data-map-timeline]')
  const windows = timeline.getByRole('group', { name: 'Window' })
  await expect(timeline.getByText(/YoY/)).toHaveCount(0)
  await windows.getByRole('button', { name: '1 mo' }).click()
  await expect(timeline.getByText(/YoY/)).toBeVisible()
  await windows.getByRole('button', { name: 'Cumul.' }).click()
  await expect(timeline.getByText(/YoY/)).toHaveCount(0)
})

test('the map timeline narrows to the phone layout with options in place of the track', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/timeline')
  const timeline = page.locator('[data-map-timeline]')
  await expect(timeline).toHaveAttribute('data-density', 'mini')
  await expect(timeline.getByText('Oct–Dec 2025', { exact: true })).toBeVisible()
  await timeline.getByRole('button', { name: 'Timeline options' }).click()
  await expect(timeline.getByRole('group', { name: 'Speed' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Sightings timeline', exact: true })).toBeHidden()
})
