import { describe, it, expect } from 'vitest'
import { sumDiffStats } from './diffStats'
import type { FileDiff } from '../types/diff'

function f(additions: number, deletions: number): FileDiff {
  return { path: 'x', status: 'modified', additions, deletions, hunks: [] }
}

describe('sumDiffStats', () => {
  it('returns zeros for no files', () => {
    expect(sumDiffStats([])).toEqual({ files: 0, additions: 0, deletions: 0 })
  })

  it('totals files, additions, and deletions', () => {
    expect(sumDiffStats([f(10, 2), f(5, 3), f(0, 7)])).toEqual({ files: 3, additions: 15, deletions: 12 })
  })
})
