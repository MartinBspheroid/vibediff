import { describe, it, expect } from 'vitest'
import { fileChangeCount, isLargeFileDiff, LARGE_FILE_CHANGE_THRESHOLD } from './diffSize'

describe('diffSize', () => {
  it('sums additions and deletions', () => {
    expect(fileChangeCount({ additions: 12, deletions: 30 })).toBe(42)
  })

  it('is not large at or below the threshold', () => {
    expect(isLargeFileDiff({ additions: LARGE_FILE_CHANGE_THRESHOLD, deletions: 0 })).toBe(false)
    expect(isLargeFileDiff({ additions: 250, deletions: 250 })).toBe(false)
    expect(isLargeFileDiff({ additions: 0, deletions: 0 })).toBe(false)
  })

  it('is large once changes exceed the threshold', () => {
    expect(isLargeFileDiff({ additions: LARGE_FILE_CHANGE_THRESHOLD + 1, deletions: 0 })).toBe(true)
    expect(isLargeFileDiff({ additions: 400, deletions: 200 })).toBe(true)
  })
})
