import { describe, it, expect } from 'vitest'
import { countCommentsByFile } from './commentCounts'
import type { Comment } from '../types/diff'

function c(file: string, id: string): Comment {
  return { id, file, line: 1, lineEnd: 1, content: 'x', createdAt: '2026-01-01' }
}

describe('countCommentsByFile', () => {
  it('returns an empty map for no comments', () => {
    expect(countCommentsByFile([])).toEqual({})
  })

  it('counts comments per file', () => {
    const counts = countCommentsByFile([c('a.go', '1'), c('a.go', '2'), c('b.go', '3')])
    expect(counts).toEqual({ 'a.go': 2, 'b.go': 1 })
  })
})
