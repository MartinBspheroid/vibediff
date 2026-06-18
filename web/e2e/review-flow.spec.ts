import { test, expect } from './fixtures'

test('renders a diff for a file with a non-ASCII name', async ({ page, unicodeURL }) => {
  await page.goto(unicodeURL)
  await expect(page.getByText('café日本語.txt').first()).toBeVisible()
  await expect(page.getByText('CHANGED', { exact: false }).first()).toBeVisible()
})

test('shows a binary-file message for an untracked binary file', async ({ page, binaryURL }) => {
  await page.goto(binaryURL)
  await expect(page.getByText('logo.png').first()).toBeVisible()
  await expect(page.getByText(/Binary file/).first()).toBeVisible()
})

test('renders an untracked text file without a spurious trailing blank line', async ({ page, newFileURL }) => {
  await page.goto(newFileURL)
  await expect(page.getByText('notes.txt').first()).toBeVisible()
  await expect(page.getByText('gamma')).toBeVisible()
  // Exactly 3 added lines — not 4 (a trailing newline must not create a blank row).
  await expect(page.locator('.diff-line')).toHaveCount(3)
})

test('shows staged files in a repo with no commits yet', async ({ page, noCommitURL }) => {
  await page.goto(noCommitURL)
  await expect(page.getByText('first.txt').first()).toBeVisible()
  await expect(page.getByText('alpha')).toBeVisible()
  // No error state.
  await expect(page.getByText("Couldn't load the diff")).toHaveCount(0)
})

test('opens the keyboard-shortcuts help with "?" and the header button', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  // "?" opens the help overlay.
  await page.keyboard.press('Shift+/')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Keyboard shortcuts')).toBeVisible()
  await expect(dialog.getByText('Next file')).toBeVisible()

  // Escape closes it.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // The header button opens it too.
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('highlights only the changed words within a modified line', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  // The fixture changes "line two" -> "line two CHANGED": only the appended
  // word should carry an intra-line highlight, not the whole line.
  const mark = page.locator('.diff-word-add').first()
  await expect(mark).toBeVisible()
  await expect(mark).toContainText('CHANGED')
  // The unchanged prefix "line two" must NOT be inside the highlight.
  await expect(mark).not.toContainText('line')
})

test('renders the diff for the changed file', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()
  // The changed content shows up in the diff.
  await expect(page.getByText('CHANGED', { exact: false }).first()).toBeVisible()
  // The sidebar shows a total diff-stats summary.
  await expect(page.getByLabel(/additions and \d+ deletions across 1 files/)).toBeVisible()
})

test('switches diff type to Staged (no staged changes in fixture)', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  await page.getByRole('button', { name: 'Staged', exact: true }).click()
  // Nothing is staged in the fixture, so the empty state appears.
  await expect(page.getByText('No changes to display')).toBeVisible()
  await expect(page.getByText(/working tree is clean/i)).toBeVisible()
})

test('target selector lists grouped branches and tags', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  await page.getByLabel('Compare against').click()
  // The shadcn Select dropdown groups refs under labelled sections.
  const listbox = page.getByRole('listbox')
  await expect(listbox.getByText('Branches')).toBeVisible()
  await expect(listbox.getByText('Tags')).toBeVisible()
  await expect(page.getByRole('option', { name: 'Working tree (default)' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'v0' })).toBeVisible()

  // Escape closes the dropdown without changing the selection.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByLabel('Compare against')).toContainText('Working tree (default)')
})

test('compares against a selected tag via the target selector', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  // Selecting the "v0" tag diffs the working tree against that tag.
  await page.getByLabel('Compare against').click()
  await page.getByRole('option', { name: 'v0' }).click()

  // The diff still shows hello.txt (working tree differs from the tagged commit),
  // and no error state appears.
  await expect(page.getByLabel('Compare against')).toContainText('v0')
  await expect(page.getByText('hello.txt').first()).toBeVisible()
  await expect(page.getByText("Couldn't load the diff")).toHaveCount(0)
})

test('remembers the selected comparison target across reloads', async ({ page, appURL }) => {
  await page.goto(appURL)
  await page.getByLabel('Compare against').click()
  await page.getByRole('option', { name: 'v0' }).click()
  await expect(page.getByLabel('Compare against')).toContainText('v0')

  await page.reload()
  await expect(page.getByLabel('Compare against')).toContainText('v0')
})

test('marks a file as viewed, collapsing it, and persists across reload', async ({ page, appURL }) => {
  await page.goto(appURL)
  // "All Files" mode renders collapsible file cards (single-file mode is always expanded).
  await page.getByRole('button', { name: 'All Files', exact: true }).click()

  const fileCard = page.locator('[id="file-hello.txt"]')
  await expect(fileCard.locator('table')).toHaveCount(1)

  const viewed = page.getByRole('checkbox', { name: /viewed/i }).first()
  await viewed.check()

  // Marking viewed collapses the file (its diff table is removed) and the sidebar counts it.
  await expect(fileCard.locator('table')).toHaveCount(0)
  await expect(page.getByText(/1 viewed/)).toBeVisible()

  // State survives a reload (persisted in localStorage).
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /viewed/i }).first()).toBeChecked()
  await expect(page.getByText(/1 viewed/)).toBeVisible()
})

test('focuses the file filter with the "/" shortcut', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  await page.keyboard.press('/')
  const filter = page.getByLabel('Filter files by path')
  await expect(filter).toBeFocused()
  // The "/" focuses rather than typing into the field.
  await expect(filter).toHaveValue('')
})

test('clears the file filter with Escape', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  const filter = page.getByLabel('Filter files by path')
  await filter.fill('nomatch-xyz')
  await expect(page.getByText(/No files match/)).toBeVisible()

  await filter.press('Escape')
  await expect(filter).toHaveValue('')
  await expect(page.getByText('hello.txt').first()).toBeVisible()
})

test('filters the file list by path', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  const filter = page.getByLabel('Filter files by path')
  await filter.fill('nomatch-xyz')
  await expect(page.getByText(/No files match/)).toBeVisible()

  await filter.fill('hello')
  await expect(page.getByText('hello.txt').first()).toBeVisible()
  await expect(page.getByText(/1 of 1 files/)).toBeVisible()
})

test('shows file status badges and filters by status', async ({ page, appURL }) => {
  await page.goto(appURL)
  await page.getByRole('button', { name: 'All Files', exact: true }).click()

  // hello.txt is committed then modified, so it carries a "Modified" badge.
  const fileCard = page.locator('[id="file-hello.txt"]')
  await expect(fileCard.getByText('Modified')).toBeVisible()

  // Filtering by "Added" excludes it; switching to "Modified" brings it back.
  await page.getByLabel('Filter files by status').click()
  await page.getByRole('option', { name: 'Added' }).click()
  await expect(page.getByText('No files match the current filters.')).toBeVisible()
  await page.getByLabel('Filter files by status').click()
  await page.getByRole('option', { name: 'Modified' }).click()
  await expect(page.getByText('hello.txt').first()).toBeVisible()
})

test('file collapse control is keyboard operable', async ({ page, appURL }) => {
  await page.goto(appURL)
  await page.getByRole('button', { name: 'All Files', exact: true }).click()

  const fileCard = page.locator('[id="file-hello.txt"]')
  await expect(fileCard.locator('table')).toHaveCount(1)

  // The chevron is a real <button aria-expanded>, operable via keyboard.
  const collapseBtn = page.getByRole('button', { name: /Collapse hello\.txt/ })
  await collapseBtn.focus()
  await page.keyboard.press('Enter')
  await expect(fileCard.locator('table')).toHaveCount(0)
})

test('opens the full-file modal and restores focus on close', async ({ page, appURL }) => {
  await page.goto(appURL)
  const trigger = page.getByRole('button', { name: 'View full file' }).first()
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: /Full file: hello\.txt/ })
  await expect(dialog).toBeVisible()

  // Focus is trapped inside the modal: Tabbing keeps focus within the dialog.
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  // Focus returns to the button that opened the modal (a11y).
  await expect(trigger).toBeFocused()
})

test('shows a "live updates paused" indicator when the server connection drops', async ({ page, server }) => {
  await page.goto(server.url)
  await expect(page.getByText('hello.txt').first()).toBeVisible()
  // No indicator while connected.
  await expect(page.getByText(/Live updates paused/)).toHaveCount(0)

  // Killing the server closes the WebSocket → the indicator appears.
  server.stop()
  await expect(page.getByText(/Live updates paused/)).toBeVisible({ timeout: 10_000 })
})

test('respects prefers-reduced-motion (neutralizes transitions)', async ({ page, appURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(appURL)
  const btn = page.getByRole('button', { name: 'All Files', exact: true })
  await expect(btn).toBeVisible()

  const duration = await btn.evaluate((el) => getComputedStyle(el).transitionDuration)
  const ms = duration.trim().endsWith('ms') ? parseFloat(duration) : parseFloat(duration) * 1000
  expect(ms).toBeLessThanOrEqual(1)
})

test('live-updates the diff when a file changes on disk', async ({ page, server }) => {
  await page.goto(server.url)
  await expect(page.getByText('CHANGED', { exact: false }).first()).toBeVisible()

  // Edit the file on disk; the watcher + WebSocket should refresh the diff
  // without a manual reload.
  server.writeFile('hello.txt', 'line one\nline two LIVE-EDIT\nline three\n')
  await expect(page.getByText('LIVE-EDIT', { exact: false }).first()).toBeVisible({ timeout: 10_000 })
})

test('toggles dark mode and persists it across reload', async ({ page, appURL }) => {
  await page.goto(appURL)
  const html = page.locator('html')

  // Normalize to light first if the environment started dark.
  if (await html.evaluate((el) => el.classList.contains('dark'))) {
    await page.getByRole('button', { name: /switch to light mode/i }).click()
  }
  await page.getByRole('button', { name: /switch to dark mode/i }).click()
  await expect(html).toHaveClass(/dark/)

  await page.reload()
  await expect(html).toHaveClass(/dark/)
})

test('adds a comment in split view', async ({ page, appURL }) => {
  await page.goto(appURL)
  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await expect(page.getByText('CHANGED', { exact: false }).first()).toBeVisible()

  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await page.getByPlaceholder('Leave a comment').fill('split view comment')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()

  await expect(page.getByText('split view comment')).toBeVisible()
})

test('adds a review comment and persists it to the API', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  // The + button reveals on row hover; click it to start a single-line comment.
  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })

  // Dialog opens; fill and submit.
  const textarea = page.getByPlaceholder('Leave a comment')
  await expect(textarea).toBeVisible()
  await textarea.fill('Please rename this variable')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()

  // It renders in the UI...
  await expect(page.getByText('Please rename this variable')).toBeVisible()

  // The sidebar shows a comment-count badge for the file.
  await expect(page.getByLabel('1 comment').first()).toBeVisible()

  // ...and is persisted server-side.
  const res = await page.request.get(`${appURL}/api/review/comments`)
  expect(res.ok()).toBeTruthy()
  const comments = (await res.json()) as { content: string }[]
  expect(comments.some((c) => c.content === 'Please rename this variable')).toBeTruthy()
})

test('keeps the comment and shows an error when saving fails', async ({ page, server }) => {
  await page.goto(server.url)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await page.getByPlaceholder('Leave a comment').fill('important note')

  // Kill the server so the save request fails.
  server.stop()
  await page.getByRole('button', { name: 'Comment', exact: true }).click()

  // The dialog stays open, shows an error, and preserves the typed content.
  await expect(page.getByRole('alert')).toContainText(/could not save/i)
  await expect(page.getByPlaceholder('Leave a comment')).toHaveValue('important note')
})

test('edits an existing review comment', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await page.getByPlaceholder('Leave a comment').fill('initial note')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('initial note')).toBeVisible()

  // Edit it inline, saving with the Ctrl+Enter keyboard shortcut.
  await page.getByRole('button', { name: /Edit comment/ }).first().click()
  const editor = page.getByRole('textbox', { name: /Edit comment/ })
  await editor.fill('edited note')
  await editor.press('Control+Enter')

  await expect(page.getByText('edited note')).toBeVisible()
  await expect(page.getByText('initial note')).toHaveCount(0)

  // The edit is persisted server-side.
  const res = await page.request.get(`${appURL}/api/review/comments`)
  const comments = (await res.json()) as { content: string }[]
  expect(comments.some((c) => c.content === 'edited note')).toBeTruthy()
})

test('keeps the edit and shows an error when saving the edit fails', async ({ page, server }) => {
  await page.goto(server.url)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  // Add a comment while the server is up.
  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await page.getByPlaceholder('Leave a comment').fill('first version')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('first version')).toBeVisible()

  // Start editing, then kill the server before saving.
  await page.getByRole('button', { name: /Edit comment/ }).first().click()
  const editor = page.getByRole('textbox', { name: /Edit comment/ })
  await editor.fill('edited version')
  server.stop()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // The editor stays open with the draft, and an error is shown.
  await expect(page.getByRole('alert')).toContainText(/could not save/i)
  await expect(editor).toHaveValue('edited version')
})

test('keeps the comment and shows an error when deleting fails', async ({ page, server }) => {
  await page.goto(server.url)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await page.getByPlaceholder('Leave a comment').fill('to delete')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('to delete')).toBeVisible()

  // Kill the server, then try to delete.
  server.stop()
  await page.getByRole('button', { name: /Delete comment/ }).first().click()

  await expect(page.getByRole('alert')).toContainText(/could not delete/i)
  // The comment is still present (delete did not take effect).
  await expect(page.getByText('to delete')).toBeVisible()
})

test('copies the review to the clipboard as text', async ({ page, context, appURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  // No comments yet -> no copy button.
  await expect(page.getByRole('button', { name: /copy review comments as text/i })).toHaveCount(0)

  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await page.getByPlaceholder('Leave a comment').fill('please rename this')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('please rename this')).toBeVisible()

  // Copy as text — feedback is a toast.
  const copyText = page.getByRole('button', { name: /copy review comments as text/i })
  await copyText.click()
  await expect(page.getByText('Review copied as text')).toBeVisible()
  const asText = await page.evaluate(() => navigator.clipboard.readText())
  expect(asText).toContain('please rename this')
  expect(asText).toMatch(/hello\.txt:\d/)

  // Copy as JSON.
  await page.getByRole('button', { name: /copy review comments as json/i }).click()
  await expect(page.getByText('Review copied as JSON')).toBeVisible()
  const asJson = await page.evaluate(() => navigator.clipboard.readText())
  const parsed = JSON.parse(asJson) as { content: string }[]
  expect(parsed.some((c) => c.content === 'please rename this')).toBeTruthy()
})

test('deletes a review comment', async ({ page, appURL }) => {
  await page.goto(appURL)
  await expect(page.getByText('hello.txt').first()).toBeVisible()

  const addButton = page.getByRole('button', { name: /Add review comment/ }).first()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click({ force: true })
  await page.getByPlaceholder('Leave a comment').fill('temporary note')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('temporary note')).toBeVisible()

  await page.getByRole('button', { name: /Delete comment/ }).first().click()
  await expect(page.getByText('temporary note')).toHaveCount(0)
})
