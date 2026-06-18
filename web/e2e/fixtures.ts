import { test as base } from '@playwright/test'
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// The binary is built at the repo root by `task build` / `go build -o vibediff .`.
const BINARY = join(here, '..', '..', 'vibediff')

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' })
}

async function waitForServer(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/diff`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`vibediff server did not start at ${url}`)
}

interface AppServer {
  url: string
  /** Kills the server process (to test disconnect/reconnect behavior). */
  stop: () => void
}

interface Fixtures {
  server: AppServer
  appURL: string
  /** Base URL of a server whose repo has a non-ASCII filename. */
  unicodeURL: string
  /** Base URL of a server whose repo has an untracked binary file. */
  binaryURL: string
  /** Base URL of a server whose repo has an untracked 3-line text file. */
  newFileURL: string
  /** Base URL of a server whose repo has staged files but no commits. */
  noCommitURL: string
}

function initRepo(dir: string): void {
  git(dir, 'init', '-b', 'main')
  git(dir, 'config', 'user.email', 't@e.com')
  git(dir, 'config', 'user.name', 'Test')
  git(dir, 'config', 'commit.gpgsign', 'false')
}

/** The default review fixture repo: one committed file with an uncommitted edit. */
function defaultRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'hello.txt'), 'line one\nline two\nline three\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  git(dir, 'tag', 'v0') // a ref to compare against in the target selector
  writeFileSync(join(dir, 'hello.txt'), 'line one\nline two CHANGED\nline three\n')
}

/** A repo whose file has a non-ASCII name (exercises core.quotePath handling). */
function unicodeRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'café日本語.txt'), 'one\ntwo\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  writeFileSync(join(dir, 'café日本語.txt'), 'one\ntwo CHANGED\n')
}

/** A repo with an untracked binary file (contains a NUL byte). */
function binaryRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'seed.txt'), 'x\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  writeFileSync(join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]))
}

/** A repo with an untracked 3-line text file ending in a newline. */
function newFileRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'seed.txt'), 'x\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  writeFileSync(join(dir, 'notes.txt'), 'alpha\nbeta\ngamma\n')
}

/** A freshly-init'd repo with a staged file but no commits yet. */
function noCommitRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'first.txt'), 'alpha\nbeta\n')
  git(dir, 'add', 'first.txt')
}

interface RunningServer {
  url: string
  stop: () => void
  teardown: () => void
}

async function launchServer(setupRepo: (dir: string) => void, port: number): Promise<RunningServer> {
  const dir = mkdtempSync(join(tmpdir(), 'vibediff-e2e-'))
  setupRepo(dir)
  const proc: ChildProcess = spawn(BINARY, ['-no-open', '-port', String(port)], {
    cwd: dir,
    stdio: 'ignore',
  })
  const url = `http://localhost:${String(port)}`
  await waitForServer(url)
  return {
    url,
    // SIGKILL drops the port immediately (SIGTERM would trigger the server's
    // graceful shutdown, letting in-flight requests through).
    stop: () => { proc.kill('SIGKILL') },
    teardown: () => {
      proc.kill()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/**
 * Launches the real vibediff binary against a throwaway git repo (headless, no
 * browser auto-open) and exposes its base URL. Tears everything down afterwards.
 */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  server: async ({}, use, testInfo) => {
    const s = await launchServer(defaultRepo, 8900 + (testInfo.workerIndex || 0))
    try {
      await use({ url: s.url, stop: s.stop })
    } finally {
      s.teardown()
    }
  },
  appURL: async ({ server }, use) => {
    await use(server.url)
  },
  // eslint-disable-next-line no-empty-pattern
  unicodeURL: async ({}, use, testInfo) => {
    const s = await launchServer(unicodeRepo, 8950 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  binaryURL: async ({}, use, testInfo) => {
    const s = await launchServer(binaryRepo, 8970 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  newFileURL: async ({}, use, testInfo) => {
    const s = await launchServer(newFileRepo, 8990 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  noCommitURL: async ({}, use, testInfo) => {
    const s = await launchServer(noCommitRepo, 9010 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
})

export { expect } from '@playwright/test'
