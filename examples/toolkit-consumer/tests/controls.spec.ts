import { expect, test } from '@playwright/test'

test('compiled numeric fields retain drafts, nullable measurements, commits and bounds', async ({ page }) => {
  await page.goto('/controls')
  const required = page.getByRole('spinbutton', { name: 'Required quantity m', exact: true })
  await required.fill('')
  await expect(page.getByRole('status', { name: 'Required value' })).toHaveText('12')
  await required.blur()
  await expect(required).toHaveValue('12')
  await required.press('ArrowUp')
  await expect(required).toHaveValue('12.5')
  await expect(page.getByRole('status', { name: 'Required value' })).toHaveText('12.5')
  await required.fill('12.2')
  await required.press('ArrowUp')
  await expect(required).toHaveValue('12.5')

  const optional = page.getByRole('spinbutton', { name: 'Optional measurement', exact: true })
  await optional.fill('')
  await optional.blur()
  await expect(page.getByRole('status', { name: 'Optional value' })).toHaveText('Missing')
  await expect(optional).toHaveValue('')

  const committed = page.getByRole('spinbutton', { name: 'Committed quantity', exact: true })
  await committed.fill('30')
  await expect(page.getByRole('status', { name: 'Committed value' })).toHaveText('4')
  await committed.press('Enter')
  await expect(committed).toHaveValue('10')
  await expect(page.getByRole('status', { name: 'Committed value' })).toHaveText('10')
  await expect(required).toHaveAccessibleDescription('An empty draft restores the previous quantity when committed.')
  await page.getByRole('slider', { name: 'Layer opacity', exact: true }).focus()
  await page.getByRole('slider', { name: 'Layer opacity', exact: true }).press('ArrowRight')
  await expect(page.getByRole('status', { name: 'Opacity value' })).toHaveText('45')
})

test('native selection, label associations, refs and manual clipboard fallback survive extraction', async ({
  page,
}) => {
  await page.goto('/controls')
  await page.getByRole('combobox', { name: 'Display mode', exact: true }).selectOption('expanded')
  await expect(page.getByRole('status', { name: 'Selected mode' })).toHaveText('expanded')
  const layers = page.getByRole('listbox', { name: 'Visible layers', exact: true })
  await layers.selectOption(['water', 'forest'])
  await expect(page.getByRole('status', { name: 'Selected layers' })).toHaveText('water, forest')
  await page.getByRole('button', { name: 'Focus layers' }).click()
  await expect(layers).toBeFocused()
  await expect(layers).toHaveAccessibleDescription('Native multiple selection and forwarded refs are retained.')
  await page.getByRole('button', { name: 'Copy example link' }).click()
  await expect(page.getByRole('button', { name: 'Copy failed' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Copy link manually', exact: true })).toHaveValue(
    'https://example.org/shared-view',
  )
})
