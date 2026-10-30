import { expect, test } from '@playwright/test'

for (const viewport of [
  { name: 'desktop', width: 1100, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(viewport.name, () => {
    test.use({ viewport })

    test('dialog closes after its visible exit and restores background focus', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('/tests/fixtures/dialog-motion.html')
      const trigger = page.getByRole('button', { name: 'Open settings' })
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: 'Map settings' })
      await expect(dialog.getByRole('textbox')).toBeFocused()
      await expect(page.getByTestId('chrome-state')).toHaveText('hidden')
      await dialog.evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished))
      })
      const bounds = await dialog.boundingBox()
      expect(bounds).not.toBeNull()
      if (viewport.name === 'mobile') {
        expect(Math.abs(bounds!.y + bounds!.height - viewport.height)).toBeLessThan(1)
      } else {
        expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThan(1)
        expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThan(1)
      }

      // Observe the first exit frame in-browser: removing the Portal's themed
      // wrapper immediately would make the actual surface animation disappear.
      const exit = await dialog.evaluate(async (node) => {
        node.querySelector<HTMLButtonElement>('[data-testid="dialog-done"]')!.click()
        await new Promise(requestAnimationFrame)
        return {
          connected: node.isConnected,
          state: node.getAttribute('data-state'),
          blocked: getComputedStyle(node).pointerEvents === 'none',
          animating: node.getAnimations().some((animation) => animation.playState === 'running'),
        }
      })
      expect(exit).toEqual({ connected: true, state: 'closed', blocked: true, animating: true })
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await expect(page.getByTestId('chrome-state')).toHaveText('visible')
      await page.getByRole('button', { name: 'Background action' }).click()
      await expect(page.getByRole('button', { name: 'Background action' })).toBeFocused()
      expect(errors).toEqual([])
    })

    for (const kind of ['shell', 'record']) {
      test(`conditionally mounted ${kind} completes its exit before notifying its host`, async ({ page }) => {
        await page.goto('/tests/fixtures/dialog-motion.html')
        const trigger = page.getByRole('button', { name: `Open conditional ${kind}` })
        await trigger.click()
        const dialog = page.getByRole('dialog', { name: `Conditional ${kind}` })
        await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
        await dialog.evaluate(async (node) => {
          await Promise.all(node.getAnimations().map((animation) => animation.finished))
        })
        const exit = await dialog.evaluate(async (node, type) => {
          const close = [...node.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
            type === 'record' ? button.textContent?.trim() === 'Close' : button.ariaLabel === 'Dismiss shell',
          )!
          // Duplicate close requests must still notify the mounting host once.
          close.click()
          close.click()
          await new Promise(requestAnimationFrame)
          return {
            connected: node.isConnected,
            state: node.getAttribute('data-state'),
            inert: (node as HTMLElement).inert,
            closeCount: document.querySelector('[data-testid="close-count"]')?.textContent,
          }
        }, kind)
        expect(exit).toEqual({ connected: true, state: 'closed', inert: true, closeCount: '0' })
        await expect(page.locator('[role="dialog"]')).toHaveCount(0)
        await expect(page.getByTestId('close-count')).toHaveText('1')
        await expect(trigger).toBeFocused()
      })
    }
  })
}

test('reduced motion closes without retaining an animated modal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/tests/fixtures/dialog-motion.html')
  const trigger = page.getByRole('button', { name: 'Open settings' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Map settings' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox')).toBeFocused()
  expect(await dialog.evaluate((node) => node.getAnimations().length)).toBe(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.getByTestId('chrome-state')).toHaveText('visible')

  const recordTrigger = page.getByRole('button', { name: 'Open conditional record' })
  await recordTrigger.click()
  const recordDialog = page.getByRole('dialog', { name: 'Conditional record' })
  await expect(recordDialog).toBeVisible()
  // Radix installs modal keyboard handlers with its autofocus effects. Reduced
  // motion makes the surface visible before those effects necessarily run.
  await expect(recordDialog.getByRole('button', { name: 'Dismiss record' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await expect(page.getByTestId('close-count')).toHaveText('1')
  await expect(recordTrigger).toBeFocused()
})

test('controlled reopening cancels a pending close and preserves the edit', async ({ page }) => {
  await page.goto('/tests/fixtures/dialog-motion.html')
  const trigger = page.getByRole('button', { name: 'Open controlled shell' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Controlled shell' })
  await dialog.getByRole('textbox').fill('Preserve the edit')
  await dialog.evaluate(async (node) => {
    node.querySelector<HTMLButtonElement>('[aria-label="Dismiss controlled shell"]')!.click()
    await new Promise(requestAnimationFrame)
    // Simulate a host replacing the controlled open prop during the exit.
    document.querySelector<HTMLButtonElement>('[data-testid="hide-controlled"]')!.click()
    await new Promise(requestAnimationFrame)
    document.querySelector<HTMLButtonElement>('[data-testid="show-controlled"]')!.click()
  })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox')).toHaveValue('Preserve the edit')
  await dialog.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished))
  })
  await expect(page.getByTestId('close-count')).toHaveText('0')
  await page.getByRole('button', { name: 'Dismiss controlled shell' }).click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await expect(page.getByTestId('close-count')).toHaveText('1')
  await expect(trigger).toBeFocused()
})
