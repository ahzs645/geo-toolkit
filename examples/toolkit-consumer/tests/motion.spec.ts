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
      const running = node.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running')
      stable =
        !running && Math.abs(rect.top - previous.top) < 0.1 && Math.abs(rect.width - previous.width) < 0.1
          ? stable + 1
          : 0
      if (stable >= 4) return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      previous = rect
    }
    throw new Error('Panel geometry did not settle')
  })
}

async function ready(page: Page) {
  await page.goto(fixture)
  await expect(page.getByTestId('map-state')).toHaveAttribute('data-loaded', 'true')
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
}

async function settledCamera(page: Page) {
  return page.evaluate(async () => {
    const map = window.__motionMap!
    let previous = map.getCenter().toArray()
    let stable = 0
    for (let frame = 0; frame < 180; frame++) {
      await new Promise(requestAnimationFrame)
      const center = map.getCenter().toArray()
      stable =
        !map.isMoving() && Math.abs(center[0] - previous[0]) + Math.abs(center[1] - previous[1]) < 1e-9 ? stable + 1 : 0
      if (stable >= 4) return center
      previous = center
    }
    throw new Error('Map camera did not settle')
  })
}

async function touchSession(page: Page) {
  const session = await page.context().newCDPSession(page)
  return {
    start: (x: number, y: number) =>
      session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y, id: 0, radiusX: 2, radiusY: 2, force: 1 }],
      }),
    move: async (x: number, y: number) => {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, id: 0, radiusX: 2, radiusY: 2, force: 1 }],
      })
      await page.evaluate(() => new Promise(requestAnimationFrame))
    },
    end: () => session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    dispose: () => session.detach(),
  }
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`mobile cards follow the finger and retain edits across keyboard detents (${reducedMotion})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ ...mobile, reducedMotion })
    const page = await context.newPage()
    try {
      await ready(page)
      await page.getByRole('button', { name: 'Select A', exact: true }).click()
      const card = page.getByRole('dialog', { name: 'Feature A', exact: true })
      const handle = card.getByRole('separator', { name: 'Resize selected feature card' })
      await expect(card).toHaveAttribute('data-feature-card-state', 'open')
      await expect(handle).toHaveAttribute('aria-valuenow', '1')
      await page.getByLabel('Selected feature note').fill('Edited before dragging')
      const initial = await settledRect(card)
      const beforeDrag = await settledCamera(page)
      const grip = (await handle.boundingBox())!
      const finger = await touchSession(page)
      try {
        await finger.start(grip.x + grip.width / 2, grip.y + grip.height / 2)
        await finger.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - 38)
        expect(Math.abs((await card.boundingBox())!.y - (initial.y - 38))).toBeLessThan(3)
        await finger.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - 72)
        expect(Math.abs((await card.boundingBox())!.y - (initial.y - 72))).toBeLessThan(3)
        const duringDrag = await page.evaluate(() => window.__motionMap!.getCenter().toArray())
        expect(duringDrag[0]).toBeCloseTo(beforeDrag[0], 6)
        expect(duringDrag[1]).toBeCloseTo(beforeDrag[1], 6)
        await finger.end()
      } finally {
        await finger.dispose()
      }
      await settledRect(card)
      await handle.press('Home')
      await expect(handle).toHaveAttribute('aria-valuenow', '0')
      await settledRect(card)
      const body = card.locator('[data-mobile-feature-card-body]')
      await expect(body).toHaveAttribute('inert', '')
      await handle.press('End')
      await expect(handle).toHaveAttribute('aria-valuenow', '2')
      await settledRect(card)
      await expect(body).not.toHaveAttribute('inert', '')
      await expect(page.getByLabel('Selected feature note')).toHaveValue('Edited before dragging')
      await handle.press('ArrowDown')
      await expect(handle).toHaveAttribute('aria-valuenow', '1')
      await settledRect(card)
    } finally {
      await context.close()
    }
  })

  test(`inactive stacked cards leave the tab order and closing finishes once (${reducedMotion})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ ...mobile, reducedMotion })
    const page = await context.newPage()
    try {
      await ready(page)
      await page.getByRole('button', { name: 'Select A', exact: true }).click()
      const first = page.getByRole('dialog', { name: 'Feature A', exact: true })
      await settledRect(first)
      await page.getByRole('button', { name: 'Toggle comparison', exact: true }).click()
      const comparison = page.getByRole('dialog', { name: 'Comparison', exact: true })
      await settledRect(comparison)
      const rearBody = first.locator('[data-mobile-feature-card-body]')
      await expect(rearBody).toHaveAttribute('inert', '')
      await page.getByRole('button', { name: 'Select B', exact: true }).focus()
      for (let step = 0; step < 16; step++) {
        await page.keyboard.press('Tab')
        expect(await rearBody.evaluate((node) => node.contains(document.activeElement))).toBe(false)
      }
      await comparison.getByRole('button', { name: 'Close feature card' }).click()
      await expect(comparison).toHaveCount(0)
      await expect(rearBody).not.toHaveAttribute('inert', '')

      if (reducedMotion === 'no-preference') {
        // Both actions happen in one browser task, before an exit can finish.
        // The mounted component receives a different selection identity.
        await page.evaluate(() => {
          const close = document.querySelector<HTMLButtonElement>(
            '[role="dialog"] button[aria-label="Close feature card"]',
          )!
          const replace = [...document.querySelectorAll<HTMLButtonElement>('nav button')].find(
            (node) => node.textContent === 'Select B',
          )!
          close.click()
          replace.click()
        })
      } else {
        // Reduced motion completes immediately; repeated close requests still
        // belong to the same exit and must not invoke the owner twice.
        await first.getByRole('button', { name: 'Close feature card' }).evaluate((node) => {
          ;(node as HTMLButtonElement).click()
          ;(node as HTMLButtonElement).click()
        })
        await expect(first).toHaveCount(0)
        await expect(page.getByTestId('closed-count')).toHaveText('1')
        await page.getByRole('button', { name: 'Select B', exact: true }).click()
      }
      const completedBeforeReplacement = reducedMotion === 'reduce' ? 1 : 0
      const replacement = page.getByRole('dialog', { name: 'Feature B', exact: true })
      await expect(replacement).toHaveAttribute('data-feature-card-state', 'open')
      await settledRect(replacement)
      await expect(page.getByTestId('closed-count')).toHaveText(String(completedBeforeReplacement))
      // Finish an unrelated full snap too: a stale close timer must not remove B.
      await replacement.getByRole('separator', { name: 'Resize selected feature card' }).press('End')
      await settledRect(replacement)
      await expect(replacement).toHaveAttribute('data-feature-card-state', 'open')
      await expect(page.getByTestId('closed-count')).toHaveText(String(completedBeforeReplacement))
      await replacement.getByRole('button', { name: 'Close feature card' }).click()
      await expect(replacement).toHaveCount(0)
      await expect(page.getByTestId('closed-count')).toHaveText(String(completedBeforeReplacement + 1))
    } finally {
      await context.close()
    }
  })

  test(`desktop panels preserve inputs and the map while closed (${reducedMotion})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion })
    const page = await context.newPage()
    try {
      await ready(page)
      const canvas = await page.locator('.maplibregl-canvas').elementHandle()
      const sidebar = page.locator('[data-map-sidebar-wrapper="true"]')
      await page.getByLabel('Sidebar note', { exact: true }).fill('Preserved left edit')
      await page.getByLabel('Results note', { exact: true }).fill('Preserved right edit')
      const initial = await settledRect(sidebar)
      if (reducedMotion === 'no-preference') {
        const intermediate = await sidebar.evaluate(async (node) => {
          document.querySelector<HTMLButtonElement>('button[aria-label="Hide sidebar"]')!.click()
          for (let frame = 0; frame < 60; frame++) {
            await new Promise(requestAnimationFrame)
            const width = node.getBoundingClientRect().width
            if (width > 1 && width < 279) return width
          }
          return null
        })
        expect(intermediate).not.toBeNull()
        expect(intermediate!).toBeLessThan(initial.width)
      } else {
        await page.getByRole('button', { name: 'Hide sidebar', exact: true }).click()
      }
      await expect(sidebar).toHaveAttribute('inert', '')
      const closed = await settledRect(sidebar)
      expect(closed.width).toBeLessThan(1)
      await expect(sidebar.locator('input')).toHaveValue('Preserved left edit')
      await page.getByRole('button', { name: 'Show sidebar', exact: true }).click()
      await settledRect(sidebar)
      await expect(page.getByLabel('Sidebar note', { exact: true })).toHaveValue('Preserved left edit')
      await page.getByRole('button', { name: 'Hide right sidebar', exact: true }).click()
      const right = page.locator('[data-map-right-sidebar="true"]')
      await expect(right).toHaveAttribute('inert', '')
      expect((await settledRect(right)).width).toBeLessThan(1)
      await page.getByRole('button', { name: 'Show right sidebar', exact: true }).click()
      await settledRect(right)
      await expect(page.getByLabel('Results note', { exact: true })).toHaveValue('Preserved right edit')
      expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true)
      await expect(page.locator('.maplibregl-canvas')).toHaveCount(1)
    } finally {
      await context.close()
    }
  })

  test(`selected point remains above the card without following a later map gesture (${reducedMotion})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ ...mobile, reducedMotion })
    const page = await context.newPage()
    try {
      await ready(page)
      await page.getByRole('button', { name: 'Select A', exact: true }).click()
      const card = page.getByRole('dialog', { name: 'Feature A', exact: true })
      await settledRect(card)
      await card.getByRole('separator', { name: 'Resize selected feature card' }).press('End')
      await settledRect(card)
      await expect
        .poll(() =>
          page.evaluate(() => {
            const map = window.__motionMap!
            const point = map.project([-122.75, 53.915])
            const mapBounds = map.getContainer().getBoundingClientRect()
            const top = document.querySelector('[role="dialog"]')!.getBoundingClientRect().top
            return (
              !map.isMoving() &&
              point.x > 12 &&
              point.x < mapBounds.width - 12 &&
              point.y > 12 &&
              point.y + mapBounds.top < top - 12
            )
          }),
        )
        .toBe(true)
      const beforeGesture = await page.evaluate(() => window.__motionMap!.getCenter().toArray())
      const mapBox = (await page.locator('.maplibregl-canvas').boundingBox())!
      const finger = await touchSession(page)
      try {
        await finger.start(mapBox.x + 100, mapBox.y + 100)
        await finger.move(mapBox.x + 155, mapBox.y + 125)
        await finger.move(mapBox.x + 190, mapBox.y + 140)
        await finger.end()
      } finally {
        await finger.dispose()
      }
      await settledRect(card)
      const afterGesture = await settledCamera(page)
      expect(
        Math.abs(afterGesture[0] - beforeGesture[0]) + Math.abs(afterGesture[1] - beforeGesture[1]),
      ).toBeGreaterThan(0.00001)
      await card.getByRole('separator', { name: 'Resize selected feature card' }).press('End')
      await settledRect(card)
      const afterSnap = await settledCamera(page)
      expect(afterSnap[0]).toBeCloseTo(afterGesture[0], 6)
      expect(afterSnap[1]).toBeCloseTo(afterGesture[1], 6)
    } finally {
      await context.close()
    }
  })

  test(`desktop table exit removes focus and can reopen during its transition (${reducedMotion})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion })
    const page = await context.newPage()
    try {
      await ready(page)
      const canvas = await page.locator('.maplibregl-canvas').elementHandle()
      await page.getByRole('button', { name: 'Toggle table', exact: true }).click()
      const pane = page.locator('.geo-map-layout-bottom-pane')
      await settledRect(pane)
      await page.getByLabel('Table note', { exact: true }).fill('Retain during exit')
      if (reducedMotion === 'no-preference') {
        const closing = await pane.evaluate(async (node) => {
          const toggle = [...document.querySelectorAll<HTMLButtonElement>('nav button')].find(
            (button) => button.textContent === 'Toggle table',
          )!
          toggle.click()
          await new Promise(requestAnimationFrame)
          await new Promise(requestAnimationFrame)
          const state = {
            connected: node.isConnected,
            inert: (node as HTMLElement).inert,
            containsFocus: node.contains(document.activeElement),
            visible: node.getAttribute('data-motion-visible'),
          }
          toggle.click()
          return state
        })
        expect(closing).toEqual({ connected: true, inert: true, containsFocus: false, visible: 'false' })
        await settledRect(pane)
        await expect(page.getByLabel('Table note', { exact: true })).toHaveValue('Retain during exit')
      }
      await page.getByRole('button', { name: 'Toggle table', exact: true }).click()
      await expect(pane).toHaveCount(0)
      expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true)
    } finally {
      await context.close()
    }
  })
}

test('narrow desktop selection clears the overlaid results pane and ignores retained closed panels', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 815, height: 815 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  try {
    await ready(page)
    const left = page.locator('[data-map-sidebar-wrapper="true"]')
    const right = page.locator('[data-map-right-sidebar="true"]')
    await expect(right).toHaveCSS('position', 'absolute')
    await page.getByRole('button', { name: 'Select A', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const map = window.__motionMap!
          const bounds = map.getContainer().getBoundingClientRect()
          const point = map.project([-122.75, 53.915])
          const results = document.querySelector('[data-map-right-sidebar="true"]')!.getBoundingClientRect()
          return !map.isMoving() && point.x > 12 && bounds.left + point.x < results.left - 12
        }),
      )
      .toBe(true)

    await page.getByRole('button', { name: 'Hide sidebar', exact: true }).click()
    await page.getByRole('button', { name: 'Hide right sidebar', exact: true }).click()
    await settledRect(left)
    await settledRect(right)
    await expect(left).toHaveAttribute('aria-hidden', 'true')
    await expect(right).toHaveAttribute('aria-hidden', 'true')
    // The panels still have mounted children, but their clipped geometry must
    // not leave a phantom camera inset after the whole map becomes visible.
    await expect(left.locator('input')).toHaveCount(1)
    await expect(right.locator('input')).toHaveCount(1)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const map = window.__motionMap!
          if (map.isMoving()) return Infinity
          const bounds = map.getContainer().getBoundingClientRect()
          const point = map.project([-122.75, 53.915])
          return Math.hypot(point.x - bounds.width / 2, point.y - bounds.height / 2)
        }),
      )
      .toBeLessThan(2)
  } finally {
    await context.close()
  }
})

test('live reduced motion changes preserve a panned view until another selection', async ({ browser }) => {
  const context = await browser.newContext({ ...mobile, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  try {
    await ready(page)
    await page.getByRole('button', { name: 'Select A', exact: true }).click()
    const first = page.getByRole('dialog', { name: 'Feature A', exact: true })
    await settledRect(first)
    const beforeGesture = await settledCamera(page)
    const bounds = (await page.locator('.maplibregl-canvas').boundingBox())!
    const finger = await touchSession(page)
    try {
      await finger.start(bounds.x + 100, bounds.y + 100)
      await finger.move(bounds.x + 155, bounds.y + 125)
      await finger.move(bounds.x + 190, bounds.y + 140)
      await finger.end()
    } finally {
      await finger.dispose()
    }
    await settledRect(first)
    const afterGesture = await settledCamera(page)
    expect(Math.abs(afterGesture[0] - beforeGesture[0]) + Math.abs(afterGesture[1] - beforeGesture[1])).toBeGreaterThan(
      0.00001,
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await first.getByRole('separator', { name: 'Resize selected feature card' }).press('End')
    await settledRect(first)
    const afterPreferenceChange = await settledCamera(page)
    expect(afterPreferenceChange[0]).toBeCloseTo(afterGesture[0], 6)
    expect(afterPreferenceChange[1]).toBeCloseTo(afterGesture[1], 6)

    await page.getByRole('button', { name: 'Select B', exact: true }).click()
    const next = page.getByRole('dialog', { name: 'Feature B', exact: true })
    await settledRect(next)
    await next.getByRole('separator', { name: 'Resize selected feature card' }).press('End')
    await settledRect(next)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const map = window.__motionMap!
          const point = map.project([-122.65, 53.945])
          const bounds = map.getContainer().getBoundingClientRect()
          const card = document.querySelector('[role="dialog"]')!.getBoundingClientRect()
          return (
            !map.isMoving() &&
            point.x > 12 &&
            point.x < bounds.width - 12 &&
            point.y > 12 &&
            point.y + bounds.top < card.top - 12
          )
        }),
      )
      .toBe(true)
  } finally {
    await context.close()
  }
})

test('a touch catches an in-flight snap at its rendered position', async ({ browser }) => {
  const context = await browser.newContext({ ...mobile, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  try {
    await ready(page)
    await page.getByRole('button', { name: 'Select A', exact: true }).click()
    const card = page.getByRole('dialog', { name: 'Feature A', exact: true })
    const handle = card.getByRole('separator', { name: 'Resize selected feature card' })
    const compact = await settledRect(card)
    await handle.press('End')
    const expanded = await settledRect(card)
    await handle.press('ArrowDown')
    await settledRect(card)
    await handle.evaluate(async (node) => {
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      await new Promise(requestAnimationFrame)
      const panel = node.closest('[role="dialog"]')!
      const animations = panel.getAnimations()
      if (!animations.length) throw new Error('The normal-motion snap must animate')
      // Hold a real transition midway so sending a touch through the browser
      // protocol cannot race its moving 44px handle on a loaded CI worker.
      for (const animation of animations) {
        animation.pause()
        animation.currentTime = Number(animation.effect!.getTiming().duration) / 3
      }
      await new Promise(requestAnimationFrame)
    })
    const movingGrip = (await handle.boundingBox())!
    await page.evaluate(() => {
      const grip = document.querySelector('[data-mobile-feature-card-handle="true"]')!
      const dialog = grip.closest('[role="dialog"]')!
      const capture = window as typeof window & { __caughtCard?: Promise<{ before: number; after: number }> }
      capture.__caughtCard = new Promise((resolve) => {
        grip.addEventListener(
          'pointerdown',
          () => {
            const before = dialog.getBoundingClientRect().top
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve({ before, after: dialog.getBoundingClientRect().top })),
            )
          },
          { capture: true, once: true },
        )
      })
    })
    const finger = await touchSession(page)
    try {
      await finger.start(movingGrip.x + movingGrip.width / 2, movingGrip.y + movingGrip.height / 2)
      const caught = await page.evaluate(
        () =>
          (
            window as typeof window & {
              __caughtCard?: Promise<{ before: number; after: number }>
            }
          ).__caughtCard!,
      )
      expect(caught.before).toBeGreaterThan(expanded.y + 2)
      expect(caught.before).toBeLessThan(compact.y - 2)
      expect(Math.abs(caught.after - caught.before)).toBeLessThan(3)
      await finger.end()
    } finally {
      await finger.dispose()
    }
    await settledRect(card)
  } finally {
    await context.close()
  }
})
