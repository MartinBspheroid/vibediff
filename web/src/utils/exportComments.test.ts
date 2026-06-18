import { describe, it, expect } from 'vitest'
import { formatCommentsAsText, formatCommentsAsJSON } from './exportComments'
import type { Comment } from '../types/diff'

function c(over: Partial<Comment>): Comment {
  return { id: 'x', file: 'a.go', line: 1, lineEnd: 1, content: 'note', createdAt: '2026-01-01', ...over }
}

describe('formatCommentsAsText', () => {
  it('returns an empty string for no comments', () => {
    expect(formatCommentsAsText([])).toBe('')
  })

  it('formats a single-line comment as file:line + body', () => {
    expect(formatCommentsAsText([c({ file: 'main.go', line: 10, lineEnd: 10, content: 'fix this' })]))
      .toBe('main.go:10\nfix this')
  })

  it('formats a multi-line range as file:start-end', () => {
    expect(formatCommentsAsText([c({ file: 'app.ts', line: 5, lineEnd: 8, content: 'refactor' })]))
      .toBe('app.ts:5-8\nrefactor')
  })

  it('treats lineEnd of 0 as a single line', () => {
    expect(formatCommentsAsText([c({ file: 'x.go', line: 3, lineEnd: 0, content: 'y' })]))
      .toBe('x.go:3\ny')
  })

  it('separates multiple comments with a blank line', () => {
    const out = formatCommentsAsText([
      c({ file: 'a.go', line: 1, lineEnd: 1, content: 'one' }),
      c({ file: 'b.go', line: 2, lineEnd: 2, content: 'two' }),
    ])
    expect(out).toBe('a.go:1\none\n\nb.go:2\ntwo')
  })
})

describe('formatCommentsAsJSON', () => {
  it('produces valid JSON that round-trips to the comments', () => {
    const comments = [c({ id: '1', file: 'a.go', line: 3, content: 'hi' })]
    const json = formatCommentsAsJSON(comments)
    expect(JSON.parse(json)).toEqual(comments)
  })

  it('renders an empty array for no comments', () => {
    expect(formatCommentsAsJSON([])).toBe('[]')
  })
})
