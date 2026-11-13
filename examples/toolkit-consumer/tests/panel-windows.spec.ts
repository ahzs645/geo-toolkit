import { expect, test } from '@playwright/test'

test('compiled detachable panels share controlled state and isolate independent workspaces', async ({ page }) => {
  await page.goto('/charts')
  const a = page.getByRole('region', { name: 'Energy A', exact: true })
  const b = page.getByRole('region', { name: 'Energy B', exact: true })
  await a.getByRole('button', { name: 'Open Energy timeline separately', exact: true }).click()
  const pending = page.waitForEvent('popup')
  await a.getByRole('menuitem', { name: 'Open in new window', exact: true }).click()
  const child = await pending
  const panel = child.getByRole('region', { name: 'Energy timeline', exact: true })
  await expect(panel).toHaveAttribute('data-detached-panel', 'true')
  await expect(a.getByRole('region', { name: 'Energy timeline', exact: true })).toHaveCount(0)
  await expect(a.getByRole('group', { name: 'Energy timeline · detached', exact: true })).toHaveCount(0)
  await expect(a.getByRole('button', { name: 'Detached panels (1)', exact: true })).toBeVisible()
  await expect(b.getByRole('button', { name: /^Detached panels/ })).toHaveCount(0)
  await expect(panel.locator('.recharts-line-curve')).toHaveCount(4)
  await child.getByRole('button', { name: 'Show series Solar', exact: true }).click()
  await expect(a.getByLabel('Energy A observations', { exact: true })).toHaveText('49 hours · 49 points')
  await expect(b.getByLabel('Energy B observations', { exact: true })).toHaveText('49 hours · 97 points')
  await a.getByRole('button', { name: '24h', exact: true }).click()
  await expect(a.getByLabel('Energy A observations', { exact: true })).toHaveText('25 hours · 25 points')
  await expect(child.getByRole('button', { name: 'Show series Solar', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  const dimensions = await panel.boundingBox()
  expect(dimensions!.width).toBeGreaterThan(600)
  expect(dimensions!.height).toBeGreaterThan(500)
  await a.getByRole('button', { name: 'Detached panels (1)', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Detached panels', exact: true })
    .getByRole('button', {
      name: 'Return Energy timeline to workspace',
      exact: true,
    })
    .click()
  await expect.poll(() => child.isClosed()).toBe(true)
  await expect(a.getByRole('region', { name: 'Energy timeline', exact: true })).toBeVisible()
  await expect(a.getByLabel('Energy A observations', { exact: true })).toHaveText('25 hours · 25 points')
})
