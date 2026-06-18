import { describe, it, expect } from 'vitest'
import { tokenize, computeWordRanges, intralineRanges, wrapRanges, type Range } from './wordDiff'

// Extract the visible text covered by a set of ranges from a source string.
function sliceRanges(s: string, ranges: Range[]): string[] {
  return ranges.map((r) => s.slice(r.start, r.end))
}

describe('tokenize', () => {
  it('splits words, whitespace, and punctuation', () => {
    expect(tokenize('foo = bar(1)')).toEqual(['foo', ' ', '=', ' ', 'bar', '(', '1', ')'])
  })

  it('keeps unicode identifiers intact', () => {
    expect(tokenize('café日本語 x')).toEqual(['café日本語', ' ', 'x'])
  })

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([])
  })
})

describe('computeWordRanges', () => {
  it('highlights only the appended word on the new side', () => {
    const { del, add } = computeWordRanges('line two', 'line two CHANGED')
    expect(del).toEqual([])
    // The space + "CHANGED" were added (chars 8..16 of "line two CHANGED").
    expect(sliceRanges('line two CHANGED', add)).toEqual([' CHANGED'])
  })

  it('highlights the changed word on both sides', () => {
    const oldStr = 'const x = 1'
    const newStr = 'const y = 1'
    const { del, add } = computeWordRanges(oldStr, newStr)
    expect(sliceRanges(oldStr, del)).toEqual(['x'])
    expect(sliceRanges(newStr, add)).toEqual(['y'])
  })

  it('returns no ranges for identical lines', () => {
    expect(computeWordRanges('same', 'same')).toEqual({ del: [], add: [] })
  })

  it('returns no ranges when lines share nothing', () => {
    // No common tokens => whole-line background already conveys the change.
    expect(computeWordRanges('aaa', 'zzz')).toEqual({ del: [], add: [] })
  })

  it('merges adjacent changed tokens into a single range', () => {
    // "." replaced by the two adjacent tokens "+" and "-" (no shared char between).
    const oldStr = 'a.b'
    const newStr = 'a+-b'
    const { del, add } = computeWordRanges(oldStr, newStr)
    expect(sliceRanges(oldStr, del)).toEqual(['.'])
    // "+" and "-" are adjacent, so they coalesce into one highlight box.
    expect(add).toHaveLength(1)
    expect(sliceRanges(newStr, add)).toEqual(['+-'])
  })

  it('skips pathologically long (minified) lines', () => {
    const long = Array.from({ length: 500 }, (_, i) => `t${String(i)}`).join(' ')
    expect(computeWordRanges(long, `${long} x`)).toEqual({ del: [], add: [] })
  })
})

describe('intralineRanges', () => {
  it('pairs a deletion block with the following addition block index-for-index', () => {
    const lines = [
      { type: 'delete', content: 'const x = 1' },
      { type: 'add', content: 'const y = 1' },
    ]
    const map = intralineRanges(lines)
    expect(sliceRanges(lines[0].content, map.get(0) ?? [])).toEqual(['x'])
    expect(sliceRanges(lines[1].content, map.get(1) ?? [])).toEqual(['y'])
  })

  it('ignores a lone deletion with no following addition', () => {
    const map = intralineRanges([{ type: 'delete', content: 'gone' }])
    expect(map.size).toBe(0)
  })

  it('ignores context lines', () => {
    const map = intralineRanges([
      { type: 'context', content: 'unchanged' },
      { type: 'normal', content: 'also unchanged' },
    ])
    expect(map.size).toBe(0)
  })
})

describe('wrapRanges', () => {
  it('wraps a plain-text range', () => {
    expect(wrapRanges('hello world', [{ start: 6, end: 11 }], 'w')).toBe(
      'hello <span class="w">world</span>'
    )
  })

  it('returns the html unchanged when there are no ranges', () => {
    expect(wrapRanges('hello', [], 'w')).toBe('hello')
  })

  it('counts an entity as a single visible character', () => {
    // Visible text is "a<b" (3 chars); highlight the "<" at index 1.
    const html = 'a&lt;b'
    expect(wrapRanges(html, [{ start: 1, end: 2 }], 'w')).toBe('a<span class="w">&lt;</span>b')
  })

  it('never lets a highlight span cross a Prism tag boundary', () => {
    // Visible text "ab cd"; a Prism span wraps "cd". Highlight the whole thing.
    const html = 'ab <span class="token">cd</span>'
    const out = wrapRanges(html, [{ start: 0, end: 5 }], 'w')
    // The mark is closed before the token tag and reopened inside it — valid nesting.
    expect(out).toBe(
      '<span class="w">ab </span><span class="token"><span class="w">cd</span></span>'
    )
    // Tags balance: equal numbers of <span and </span>.
    const opens = (out.match(/<span/g) ?? []).length
    const closes = (out.match(/<\/span>/g) ?? []).length
    expect(opens).toBe(closes)
  })

  it('highlights a range that starts inside a token', () => {
    const html = '<span class="token">foobar</span>'
    // Highlight "bar" (visible indices 3..6).
    const out = wrapRanges(html, [{ start: 3, end: 6 }], 'w')
    expect(out).toBe('<span class="token">foo<span class="w">bar</span></span>')
  })
})
