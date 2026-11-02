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

async function touchSession(page: Page) {
  const session = await page.context().newCDPSession(page)
  const point = (x: number, y: number) => [{ x, y, id: 0, radiusX: 2, radiusY: 2, force: 1 }]
  return {
    start: (x: number, y: number) =>
      session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x, y) }),
    move: async (x: number, y: number) => {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) })
      await page.evaluate(() => new Promise(requestAnimationFrame))
    },
    end: () => session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    dispose: () => session.detach(),
  }
}

/** A vertical swipe in steps, so the gesture sees a direction before it ends. */
async function swipe(page: Page, x: number, fromY: number, toY: number) {
  const finger = await touchSession(page)
  try {
    await finger.start(x, fromY)
    for (let step = 1; step <= 10; step++) await finger.move(x, fromY + ((toY - fromY) * step) / 10)
    await finger.end()
  } finally {
    await finger.dispose()
  }
}

const scrim = (page: Page) => page.locator('[data-map-sidebar-wrapper="true"] > div[aria-hidden="true"]').first()

test('a card drags from its body as well as its grip, and shows its body while dragged open', async ({ browser }) => {
  const context = await browser.newContext({ ...mobile, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  try {
    await ready(page)
    await page.getByRole('button', { name: 'Select A', exact: true }).click()
    const featureA = card(page, 'Feature A')
    const handle = featureA.getByRole('separator', { name: 'Resize selected feature card' })
    const body = featureA.locator('[data-mobile-feature-card-body]')
    await expect(handle).toHaveAttribute('aria-valuenow', '1')
    let rect = await settledRect(featureA)

    // Below the full detent, a vertical swipe on the body moves the card.
    await swipe(page, 195, rect.top + rect.height - 30, rect.top - 220)
    await expect(handle).toHaveAttribute('aria-valuenow', '2')
    rect = await settledRect(featureA)

    // At full, with nothing scrolled, a downward swipe on the body brings it back down.
    await swipe(page, 195, rect.top + rect.height - 60, rect.top + rect.height + 120)
    await expect(handle).not.toHaveAttribute('aria-valuenow', '2')
    await settledRect(featureA)

    // Dragging a collapsed card open shows its body before the finger lifts.
    await handle.press('Home')
    await expect(handle).toHaveAttribute('aria-valuenow', '0')
    await expect(body).toHaveAttribute('inert', '')
    const grip = (await handle.boundingBox())!
    const finger = await touchSession(page)
    try {
      await finger.start(grip.x + grip.width / 2, grip.y + grip.height / 2)
      for (let step = 1; step <= 6; step++)
        await finger.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - step * 25)
      await expect(body).not.toHaveAttribute('inert', '')
      await finger.end()
    } finally {
      await finger.dispose()
    }
    await expect(handle).toHaveAttribute('aria-valuenow', '1')
    await expect(page.getByLabel('Selected feature note')).toHaveValue('Keep selected edit')
  } finally {
    await context.close()
  }
})

test('the half controls sheet leaves the map usable; tapping outside the full sheet collapses it', async ({
  browser,
}) => {
  const context = await browser.newContext({ ...mobile, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  try {
    await ready(page)
    const controls = page.locator('[data-map-mobile-sheet="true"]')
    const handle = page.locator('[data-map-mobile-sheet-handle="true"]')
    await expect(handle).toHaveAttribute('aria-valuetext', 'half panel')
    await settledRect(controls)
    await expect(scrim(page)).toHaveCSS('pointer-events', 'none')
    await expect(scrim(page)).toHaveCSS('opacity', '0')

    await handle.press('End')
    await expect(handle).toHaveAttribute('aria-valuetext', 'full panel')
    await settledRect(controls)
    await expect(scrim(page)).toHaveCSS('pointer-events', 'auto')
    const workspace = (await page.getByTestId('workspace').boundingBox())!
    await page.touchscreen.tap(workspace.x + workspace.width / 2, workspace.y + 4)
    await expect(handle).toHaveAttribute('aria-valuetext', 'collapsed panel')
  } finally {
    await context.close()
  }
})

test('tapping outside the full controls sheet brings a docked card back to the front', async ({ browser }) => {
  const context = await browser.newContext({ ...mobile, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  try {
    await ready(page)
    await page.getByRole('button', { name: 'Select A', exact: true }).click()
    const featureA = card(page, 'Feature A')
    await settledRect(featureA)

    const controls = page.locator('[data-map-mobile-sheet="true"]')
    await tapTopStrip(page, controls)
    await expect(featureA).toHaveAttribute('data-stack-role', 'docked')
    const handle = page.locator('[data-map-mobile-sheet-handle="true"]')
    await handle.press('End')
    await expect(handle).toHaveAttribute('aria-valuetext', 'full panel')
    await settledRect(controls)
    await expect(scrim(page)).toHaveCSS('pointer-events', 'auto')

    // The card the controls were raised over returns, rather than the whole
    // stack collapsing into a peek with the card hidden behind it.
    const workspace = (await page.getByTestId('workspace').boundingBox())!
    await page.touchscreen.tap(workspace.x + workspace.width / 2, workspace.y + 4)
    await expect(featureA).toHaveAttribute('data-stack-role', 'primary')
    await expect(featureA.getByRole('separator', { name: 'Resize selected feature card' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    await expect(scrim(page)).toHaveCSS('pointer-events', 'none')
    await expect(page.getByTestId('closed-count')).toHaveText('0')
  } finally {
    await context.close()
  }
})
