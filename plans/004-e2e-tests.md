# Plan 004: Add an end-to-end test harness (Playwright) for the core workflow

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 470b165..HEAD -- main.go web/ Taskfile.yml`
> If those changed, re-verify the build commands and flags below; on a mismatch
> with the excerpts, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001 (CI runs e2e)
- **Category**: tests
- **Planned at**: commit `470b165`, 2026-06-17

## Why this matters

VibeDiff's entire value — view a real git diff in the browser, add review
comments, export them — has **no end-to-end coverage**. The maintainer named
e2e tests explicitly. The product is a Go binary that serves a React SPA and
talks to `git`, so the only test that proves "it actually works" drives the real
binary against a real throwaway git repo and asserts on the rendered UI. This
plan stands up that harness and the first high-value journeys.

## Current state

- The binary serves the SPA and API on `localhost:8888` by default
  (main.go:60-66). Relevant flags:
  - `-port int` (default 8888), `-host string` (default "localhost")
  - `-no-open` — **disables auto-opening a browser** (main.go:65, 162). E2E MUST
    pass this, or every test run launches a real browser via `xdg-open`/`open`.
  - `VIBEDIFF_NO_OPEN` env var also disables opening (main.go:164).
- Build: `task build` → builds web (`cd web && npm run build`) then
  `go build -o vibediff .` (Taskfile.yml:24-30). The binary embeds `web/dist`.
- The server reads the git repo from its **current working directory**, so the
  e2e harness launches the binary with `cwd` set to a fixture repo.
- API routes that e2e can assert against (main.go:112-131): `/api/diff`,
  `/api/diff/{file}`, `/api/review/comment` (POST), `/api/review/comments` (GET).
- Frontend test stack is already Vitest (unit). E2E is a **separate** concern —
  Playwright drives a real browser against the real binary. Keep it out of the
  Vitest config.
- README documents the review flow (README.md:60-105): add comments via the `+`
  button on a line; in `text` format comments print to the terminal as added; in
  `json` format they print on shutdown.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build binary | `task build` (or `cd web && npm run build && cd .. && go build -o vibediff .`) | `./vibediff` exists |
| Install Playwright | `cd web && npm i -D @playwright/test && npx playwright install --with-deps chromium` | exit 0 |
| Run e2e | `cd web && npx playwright test` | all pass |

## Scope

**In scope** (create/modify):
- `web/package.json` (add `@playwright/test` devDep + an `e2e` script)
- `web/playwright.config.ts` (create)
- `web/e2e/fixtures.ts` (create — builds a temp git repo + launches the binary)
- `web/e2e/review-flow.spec.ts` (create — the journeys)
- `.gitignore` (add `web/test-results/`, `web/playwright-report/`)
- `web/eslint.config.js` (only if ESLint tries to lint `e2e/` and fails — add an
  ignore for `e2e/**` or `playwright.config.ts`; keep changes minimal)
- `.github/workflows/ci.yml` (add an `e2e` job — see Step 5)

**Out of scope**:
- Application source (Go or React). E2E must test the product as-is. If a journey
  fails because of a real bug, report it — don't fix product code here.
- The Vitest config / existing unit tests.

## Git workflow

- Branch: `advisor/004-e2e-tests`
- Commit message: `test(e2e): add Playwright harness and core review-flow journeys`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add Playwright

```
cd web
npm i -D @playwright/test
npx playwright install --with-deps chromium
```
**Verify**: `cd web && npx playwright --version` → prints a version.

### Step 2: A fixture that builds a temp repo and runs the real binary

Create `web/e2e/fixtures.ts`. It must, per test (or per worker):
1. Create a temp dir, `git init` it, configure user + disable gpg signing,
   commit an initial file, then make an **uncommitted** change so there is a diff.
2. Launch the built `../vibediff` binary with `cwd` = temp dir, an unused port,
   and `-no-open` so no real browser opens.
3. Wait for the server to accept connections, expose `baseURL`.
4. On teardown: kill the process, remove the temp dir.

Key shape (TypeScript, Playwright `test.extend`):

```ts
import { test as base } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BINARY = join(__dirname, '..', '..', 'vibediff') // repo-root/vibediff

function git(cwd: string, ...args: string[]) {
  execFileSync('git', args, { cwd })
}

export const test = base.extend<{ appURL: string }>({
  appURL: async ({}, use, testInfo) => {
    const dir = mkdtempSync(join(tmpdir(), 'vibediff-e2e-'))
    git(dir, 'init')
    git(dir, 'config', 'user.email', 't@e.com')
    git(dir, 'config', 'user.name', 'T')
    git(dir, 'config', 'commit.gpgsign', 'false')
    writeFileSync(join(dir, 'hello.txt'), 'line one\nline two\n')
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'init')
    writeFileSync(join(dir, 'hello.txt'), 'line one\nline two CHANGED\nline three\n')

    const port = 8900 + (testInfo.workerIndex ?? 0)
    const proc = spawn(BINARY, ['-no-open', '-port', String(port)], { cwd: dir })
    const url = `http://localhost:${port}`
    // wait for readiness
    for (let i = 0; i < 100; i++) {
      try { const r = await fetch(`${url}/api/diff`); if (r.ok) break } catch {}
      await new Promise(r => setTimeout(r, 100))
    }
    await use(url)
    proc.kill()
    rmSync(dir, { recursive: true, force: true })
  },
})
export { expect } from '@playwright/test'
```
(Adjust `BINARY` path if the binary is built elsewhere. The harness assumes
`task build` produced `repo-root/vibediff`.)

**Verify**: file compiles when Playwright runs (Step 4 covers running).

### Step 3: Playwright config

Create `web/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,        // each test spawns its own server/port
  retries: process.env.CI ? 1 : 0,
  use: { trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
```
Add to `web/package.json` scripts: `"e2e": "playwright test"`.

**Verify**: `cd web && node -e "require('./playwright.config.ts')" 2>/dev/null || true`
(config is TS; real validation is running it in Step 4.)

### Step 4: Write the core journeys

Create `web/e2e/review-flow.spec.ts` using the fixture. Before writing
assertions, **launch the app once manually and inspect the real DOM** (the UI
selectors below are guidance, not verified — confirm against the live app and
adjust):

```
task build && cd <a scratch git repo with changes> && /path/to/vibediff -no-open -port 8901
# open http://localhost:8901 in a browser, inspect element text/roles
```

Journeys to implement (each `await page.goto(appURL)` first):
1. **Diff renders**: the changed file `hello.txt` is visible, and the changed
   line text ("CHANGED") appears in the diff. Assert via visible text.
2. **Diff type switching**: switching All/Staged/Unstaged updates the view
   (locate the control by its visible label; assert the file list changes —
   unstaged shows the change, staged shows nothing for this fixture).
3. **Add a comment**: hover/click the `+` on a line, type a comment, submit, and
   assert the comment text now appears in the document.
4. **Comment persists via API**: after adding, `await page.request.get('/api/review/comments')`
   returns JSON including the comment content (this also validates the backend).
5. **Delete a comment**: delete it via the UI and assert it disappears.

Prefer role/text-based locators (`getByRole`, `getByText`, `getByPlaceholder`)
over brittle CSS. If a stable selector is missing, it is acceptable to assert via
the API request for backend-state journeys (4) while still driving the UI for the
action.

**Verify**: `task build && cd web && npx playwright test` → all journeys pass.

### Step 5: Wire e2e into CI

Add an `e2e` job to `.github/workflows/ci.yml` (created in plan 001). It must:
build the web app, build the Go binary, install Playwright browsers, run e2e.

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: [frontend, backend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22', cache: true }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: web/package-lock.json }
      - run: cd web && npm ci
      - run: cd web && npm run build
      - run: go build -o vibediff .
      - run: cd web && npx playwright install --with-deps chromium
      - run: cd web && npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: web/playwright-report }
```
**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"` → `ok`
(skip if python/yaml unavailable).

### Step 6: gitignore the artifacts

Append to `.gitignore`: `web/test-results/`, `web/playwright-report/`,
`/vibediff` (if the built binary isn't already ignored — check first; the repo
`clean` task removes `vibediff`, and `.gitignore` may already cover it).

**Verify**: `git status` shows no `test-results/`, `playwright-report/`, or
`vibediff` binary as untracked.

## Test plan

New files: `web/e2e/fixtures.ts`, `web/e2e/review-flow.spec.ts`,
`web/playwright.config.ts`. Five journeys (diff render, type switch, add comment,
API persistence, delete comment). Model future e2e specs after `review-flow.spec.ts`.

## Done criteria

ALL must hold:

- [ ] `task build && cd web && npx playwright test` → all journeys pass locally
- [ ] `web/playwright.config.ts`, `web/e2e/fixtures.ts`, `web/e2e/review-flow.spec.ts` exist
- [ ] `@playwright/test` in `web/package.json` devDependencies; `e2e` script present
- [ ] `.github/workflows/ci.yml` has an `e2e` job (valid YAML)
- [ ] `git status` clean of `test-results/`, `playwright-report/`, built binary
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report (do not improvise) if:
- A journey fails because of a genuine product bug (e.g. comments don't persist,
  diff doesn't render). Report the bug; do not patch product source in this plan.
- The UI has no stable way to locate the `+`/comment controls and inspecting the
  live DOM doesn't reveal a reliable role/text locator — report so the team can
  add `data-testid`s (a small product change, separate plan).
- `npx playwright install` cannot fetch browsers in the environment — report;
  the harness/config can still land, with the e2e CI job marked for follow-up.
- The binary can't be launched headless even with `-no-open` (e.g. it still tries
  to open a browser) — report the exact behavior.

## Maintenance notes

- The fixture is the contract: keep server-readiness polling and per-worker ports
  if parallelism is later enabled (`fullyParallel: true` requires distinct ports).
- If the team adds `data-testid` attributes to diff lines / comment controls,
  migrate locators to them for stability.
- As features grow (new diff modes, JSON export), add journeys here — this is the
  product's top-level regression net.
- Keep e2e out of the Vitest run so unit tests stay fast; they are separate
  commands and separate CI jobs.
</content>
