import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

// Scans the rendered app for WCAG 2.0/2.1 A & AA violations with axe-core.
// Fails on any serious/critical issue, guarding against accessibility regressions.

test('main diff view has no serious accessibility violations', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()
  // Wait for the transient "Updating…" refresh indicator to clear so axe scans
  // a settled UI (avoids flaky mid-render contrast reads).
  await expect(page.getByText('Updating...')).toHaveCount(0)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([])
})

test('main diff view in dark mode has no serious accessibility violations', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  // Switch to dark mode (first-class feature; verify its contrast too).
  const toggle = page.getByRole('button', { name: /switch to dark mode/i })
  if ((await toggle.count()) > 0) {
    await toggle.click()
  }
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByText('Updating...')).toHaveCount(0)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([])
})

test('all-files review view with a comment has no serious accessibility violations', async ({ page, appURL }) => {
  await page.goto(appURL)
  await page.getByRole('button', { name: 'All Files', exact: true }).click()

  // Add a comment so CommentDisplay, badges, and status chips are all rendered.
  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await page.getByPlaceholder('Leave a comment').fill('a review note')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('a review note')).toBeVisible()
  await expect(page.getByText('Updating...')).toHaveCount(0)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([])
})

test('comment dialog has no serious accessibility violations', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()
  // Wait for the transient "Updating…" refresh indicator to clear so axe scans
  // a settled UI (avoids flaky mid-render contrast reads).
  await expect(page.getByText('Updating...')).toHaveCount(0)

  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await expect(page.getByRole('dialog')).toBeVisible()

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([])
})
