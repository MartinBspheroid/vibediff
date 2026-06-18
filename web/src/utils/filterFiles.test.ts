import { describe, it, expect } from 'vitest'
import { filterFiles, filterByStatus } from './filterFiles'
import type { FileDiff, FileStatus } from '../types/diff'

function f(path: string, status: FileStatus = 'modified'): FileDiff {
  return {
    path,
    status,
    additions: 0,
    deletions: 0,
    hunks: [],
  }
}

const files = [f('src/app.ts'), f('src/util/math.ts'), f('README.md')]

describe('filterFiles', () => {
  it('returns all files for an empty or whitespace query', () => {
    expect(filterFiles(files, '')).toHaveLength(3)
    expect(filterFiles(files, '   ')).toHaveLength(3)
  })

  it('matches path substrings case-insensitively', () => {
    expect(filterFiles(files, 'SRC').map((x) => x.path)).toEqual(['src/app.ts', 'src/util/math.ts'])
    expect(filterFiles(files, 'readme')).toHaveLength(1)
    expect(filterFiles(files, 'math')).toEqual([files[1]])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterFiles(files, 'nonexistent')).toHaveLength(0)
  })
})

describe('filterByStatus', () => {
  const mixed = [f('a.ts', 'added'), f('b.ts', 'modified'), f('c.ts', 'deleted'), f('d.ts', 'renamed')]

  it('returns all files for "all"', () => {
    expect(filterByStatus(mixed, 'all')).toHaveLength(4)
  })

  it('filters to a single status', () => {
    expect(filterByStatus(mixed, 'added').map((x) => x.path)).toEqual(['a.ts'])
    expect(filterByStatus(mixed, 'deleted').map((x) => x.path)).toEqual(['c.ts'])
    expect(filterByStatus(mixed, 'renamed').map((x) => x.path)).toEqual(['d.ts'])
  })
})
