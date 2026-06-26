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
  /** Writes a file in the repo (to test live updates from the file watcher). */
  writeFile: (name: string, content: string) => void
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
  /** Base URL of a server whose repo has a long modified file (for scrolling). */
  tallURL: string
  /** Base URL of a server whose repo has a whitespace-only change. */
  whitespaceURL: string
  /** Base URL of a server with two modified files (one long), for nav/scroll. */
  multiFileURL: string
  /** Base URL of a server whose file has two consecutive lines changed. */
  multiChangeURL: string
  /** Base URL of a server with a pure (content-less) file rename. */
  renameURL: string
  /** Base URL of a server whose change adds a trailing newline (\ No newline). */
  noNewlineURL: string
  /** Base URL of a server with an untracked image file (image-diff preview). */
  imageURL: string
  /** Base URL of a server with a very large (>1500-line) diff. */
  largeDiffURL: string
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

/** A repo with an untracked non-image binary file (contains a NUL byte). */
function binaryRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'seed.txt'), 'x\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  writeFileSync(join(dir, 'data.bin'), Buffer.from([0x00, 0x01, 0x02, 0x00, 0xff]))
}

// A minimal valid 1×1 transparent PNG (also contains NUL bytes → detected binary).
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAAEAAH2FzhVAAAAAElFTkSuQmCC',
  'base64'
)

/** A repo with an untracked image file (exercises the image-diff preview). */
function imageRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'seed.txt'), 'x\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  writeFileSync(join(dir, 'pixel.png'), TINY_PNG)
}

/** A repo with an untracked 3-line text file ending in a newline. */
function newFileRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'seed.txt'), 'x\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  writeFileSync(join(dir, 'notes.txt'), 'alpha\nbeta\ngamma\n')
}

/** A repo with a long modified file, tall enough to require vertical scrolling. */
function tallRepo(dir: string): void {
  initRepo(dir)
  const original = Array.from({ length: 80 }, (_, i) => `line ${String(i + 1)}`).join('\n') + '\n'
  writeFileSync(join(dir, 'long.txt'), original)
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  // Change a line near the top so the file header has lots of diff below it.
  writeFileSync(join(dir, 'long.txt'), original.replace('line 3', 'line 3 CHANGED'))
}

/** A repo whose only change is whitespace (re-indentation + trailing space). */
function whitespaceRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'indent.txt'), 'alpha\nbeta\ngamma\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  // Only whitespace differs: leading indentation + a trailing space.
  writeFileSync(join(dir, 'indent.txt'), '  alpha \n  beta \n  gamma \n')
}

/** A repo with two modified files; the first is long enough to push the second
 *  below the fold (exercises selected-file scroll-into-view in All Files mode). */
function multiFileRepo(dir: string): void {
  initRepo(dir)
  const long = Array.from({ length: 60 }, (_, i) => `a line ${String(i + 1)}`).join('\n') + '\n'
  writeFileSync(join(dir, 'a_long.txt'), long)
  writeFileSync(join(dir, 'z_short.txt'), 'short one\nshort two\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  // Change every line so a_long's diff is tall enough to push z_short off-screen.
  const longChanged = Array.from({ length: 60 }, (_, i) => `a line ${String(i + 1)} CHANGED`).join('\n') + '\n'
  writeFileSync(join(dir, 'a_long.txt'), longChanged)
  writeFileSync(join(dir, 'z_short.txt'), 'short one CHANGED\nshort two\n')
}

/** A repo whose file has two consecutive lines changed (a 2-del / 2-add block,
 *  to verify split-view side-by-side pairing). */
function multiChangeRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'pair.txt'), 'alpha\nbravo\ncharlie\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  writeFileSync(join(dir, 'pair.txt'), 'ALPHA\nBRAVO\ncharlie\n')
}

/** A repo with a pure rename (git mv, no content change) — produces a file with
 *  Renamed status and zero hunks. */
function renameRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'old.txt'), 'alpha\nbravo\ncharlie\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  git(dir, 'mv', 'old.txt', 'new.txt')
}

/** A repo whose change is adding a trailing newline, so git emits
 *  "\ No newline at end of file" on the old line. */
function noNewlineRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'tail.txt'), 'alpha\nbravo') // no trailing newline
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  writeFileSync(join(dir, 'tail.txt'), 'alpha\nbravo\n') // add the newline
}

/** A repo with an untracked file whose diff exceeds the large-diff threshold. */
function largeDiffRepo(dir: string): void {
  initRepo(dir)
  writeFileSync(join(dir, 'seed.txt'), 'x\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-m', 'init')
  const big = Array.from({ length: 1700 }, (_, i) => `row ${String(i + 1).padStart(4, '0')}`).join('\n') + '\n'
  writeFileSync(join(dir, 'big.txt'), big)
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
  writeFile: (name: string, content: string) => void
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
    writeFile: (name: string, content: string) => { writeFileSync(join(dir, name), content) },
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
      await use({ url: s.url, stop: s.stop, writeFile: s.writeFile })
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
  // eslint-disable-next-line no-empty-pattern
  tallURL: async ({}, use, testInfo) => {
    const s = await launchServer(tallRepo, 9030 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  whitespaceURL: async ({}, use, testInfo) => {
    const s = await launchServer(whitespaceRepo, 9050 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  multiFileURL: async ({}, use, testInfo) => {
    const s = await launchServer(multiFileRepo, 9070 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  multiChangeURL: async ({}, use, testInfo) => {
    const s = await launchServer(multiChangeRepo, 9110 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  renameURL: async ({}, use, testInfo) => {
    const s = await launchServer(renameRepo, 9130 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  noNewlineURL: async ({}, use, testInfo) => {
    const s = await launchServer(noNewlineRepo, 9170 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  imageURL: async ({}, use, testInfo) => {
    const s = await launchServer(imageRepo, 9190 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
  // eslint-disable-next-line no-empty-pattern
  largeDiffURL: async ({}, use, testInfo) => {
    const s = await launchServer(largeDiffRepo, 9210 + (testInfo.workerIndex || 0))
    try {
      await use(s.url)
    } finally {
      s.teardown()
    }
  },
})

export { expect } from '@playwright/test'
