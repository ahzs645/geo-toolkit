import { expect, test } from '@playwright/test'

test('subpixel offset noise cannot cause a render loop', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const original = Element.prototype.getBoundingClientRect
    let measurement = 0
    Element.prototype.getBoundingClientRect = function () {
      const rect = original.call(this)
      if (!this.hasAttribute('data-virtual-result-list')) return rect
      // Simulate floating-point cancellation as scrollTop and viewport-relative
      // rectangles are combined. The physical list offset has not changed.
      const noise = ++measurement % 2 ? 1e-7 : -1e-7
      return new DOMRect(rect.x, rect.y + noise, rect.width, rect.height)
    }
  })
  await page.goto('/tests/fixtures/virtual-result-list.html')
  const list = page.getByRole('list', { name: 'Results', exact: true })
  await expect(list.getByRole('listitem').first()).toBeVisible()
  await page.getByRole('button', { name: 'Resize header' }).click()
  await expect
    .poll(async () => {
      const header = await page.getByTestId('header').boundingBox()
      const bounds = await list.boundingBox()
      return Math.abs(bounds!.y - header!.y - header!.height)
    })
    .toBeLessThan(1)
  expect(errors).toEqual([])
})

test('fast scrolling, header changes, keyboard navigation and filtering keep results usable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/tests/fixtures/virtual-result-list.html')
  const list = page.getByRole('list', { name: 'Results', exact: true })
  const scroll = page.locator('[data-map-sidebar-scroll]')
  await expect(list.getByRole('listitem').first()).toBeVisible()
  await scroll.evaluate(async (node) => {
    for (let index = 0; index < 100; index++) {
      node.scrollTop = (index % 2 ? 0.93 : 0.27) * node.scrollHeight + 0.125
      await new Promise(requestAnimationFrame)
    }
    node.scrollTop = 0
  })
  await page.getByRole('button', { name: 'Resize header' }).click()
  await list.getByRole('button', { name: 'Result 0', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(list.getByRole('button', { name: 'Result 999', exact: true })).toBeFocused()
  expect(await list.getByRole('listitem').count()).toBeLessThan(40)
  await page.getByRole('button', { name: 'Filter results' }).click()
  await scroll.evaluate((node) => {
    node.scrollTop = 0
  })
  await list.getByRole('button', { name: 'Result 0', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(list.getByRole('button', { name: 'Result 19', exact: true })).toBeFocused()
  expect(errors).toEqual([])
})
