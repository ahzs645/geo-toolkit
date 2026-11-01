import { expect, test, type Locator, type Page } from '@playwright/test'

const fixture = '/tests/fixtures/workspace-motion.html'
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

async function settledRect(locator: Locator) {
  return locator.evaluate(async (node) => {
    let previous = node.getBoundingClientRect()
    let stable = 0
    for (let frame = 0; frame < 180; frame++) {
      await new Promise(requestAnimationFrame)
      const rect = node.getBoundingClientRect()
      const running = document.getAnimations().some((animation) => animation.playState === 'running')
      stable =
        !running && Math.abs(rect.top - previous.top) < 0.1 && Math.abs(rect.height - previous.height) < 0.1
          ? stable + 1
          : 0
      if (stable >= 6) return { top: rect.top, height: rect.height, left: rect.left, width: rect.width }
      previous = rect
    }
    throw new Error('Sheet geometry did not settle')
  })
}

async function ready(page: Page) {
  await page.goto(fixture)
  await expect(page.getByTestId('map-state')).toHaveAttribute('data-loaded', 'true')
}

// A docked card is aria-hidden, so find cards by their panel rather than role.
const card = (page: Page, name: string) =>
  page.locator('[data-map-feature-card-panel="true"]').filter({ has: page.getByText(name, { exact: true }) })

async function tapTopStrip(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 4)
}

test('a card opened while the controls are in front stacks the earlier card behind it, tap to swap', async ({
  browser,
}) => {
  const context = await browser.newContext({ ...mobile, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  try {
    await ready(page)
    await page.getByRole('button', { name: 'Select A', exact: true }).click()
    const featureA = card(page, 'Feature A')
    await settledRect(featureA)

    // Bring the controls sheet forward: the card docks behind it.
    const controls = page.locator('[data-map-mobile-sheet="true"]')
    await tapTopStrip(page, controls)
    await expect(featureA).toHaveAttribute('data-stack-role', 'docked')
    await settledRect(controls)

    // A new card from the controls goes in front. The earlier card must become
    // the card behind it, the same height and peeking above it, not stay sized
    // to the controls sheet with an empty body.
    await page.getByRole('button', { name: 'Toggle comparison', exact: true }).click()
    const comparison = card(page, 'Comparison')
    await expect(comparison).toHaveAttribute('data-stack-role', 'primary')
    await expect(featureA).toHaveAttribute('data-stack-role', 'secondary')
    const front = await settledRect(comparison)
    const rear = await settledRect(featureA)
    expect(rear.height).toBeCloseTo(front.height, 0)
    expect(front.top - rear.top).toBeCloseTo(10, 0)
    expect(rear.left).toBeGreaterThan(front.left)
    // The controls sheet is the rearmost strip, above the card behind.
    const sheet = await settledRect(controls)
    expect(rear.top - sheet.top).toBeCloseTo(10, 0)
    await expect(featureA.locator('[data-mobile-feature-card-body]')).toHaveAttribute('inert', '')

    // Tapping the strip a rear card leaves showing swaps it with the front card;
    // it returns to its own compact detent and the other card lines up behind
    // it. Tapping the other one swaps back.
    await tapTopStrip(page, featureA)
    await expect(featureA).toHaveAttribute('data-stack-role', 'primary')
    await expect(comparison).toHaveAttribute('data-stack-role', 'secondary')
    const swapped = await settledRect(featureA)
    const behind = await settledRect(comparison)
    expect(behind.height).toBeCloseTo(swapped.height, 0)
    expect(swapped.top - behind.top).toBeCloseTo(10, 0)
    await expect(featureA.locator('[data-mobile-feature-card-body]')).not.toHaveAttribute('inert', '')
    await tapTopStrip(page, comparison)
    await expect(comparison).toHaveAttribute('data-stack-role', 'primary')
    await expect(featureA).toHaveAttribute('data-stack-role', 'secondary')
  } finally {
    await context.close()
  }
})
