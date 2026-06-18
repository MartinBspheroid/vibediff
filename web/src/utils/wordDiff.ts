// Word-level (intra-line) diff.
//
// For a pair of changed lines (a deletion and the addition that replaces it),
// we compute which *words* actually changed so the UI can highlight only those
// spans instead of painting the whole line. The highlight is overlaid on top of
// the Prism-syntax-highlighted HTML without disturbing it: `wrapRanges` walks the
// markup in the text domain and never lets a highlight span cross a Prism tag
// boundary, so the resulting HTML stays well-formed.

/** A half-open interval [start, end) measured in visible characters. */
export interface Range {
  start: number
  end: number
}

interface LineLike {
  type: string
  content: string
}

// Split into word runs, whitespace runs, and individual punctuation chars.
// Unicode-aware so identifiers like `café日本語` stay intact as single tokens.
export function tokenize(s: string): string[] {
  return s.match(/[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu) ?? []
}

interface TokenOp {
  type: 'equal' | 'del' | 'add'
  token: string
}

// Classic LCS backtrack over token arrays. Lines are short, so the O(n·m) table
// is cheap; callers guard against pathological (minified) lines before calling.
function lcsDiff(a: string[], b: string[]): TokenOp[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: TokenOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', token: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', token: a[i] })
      i++
    } else {
      ops.push({ type: 'add', token: b[j] })
      j++
    }
  }
  while (i < n) { ops.push({ type: 'del', token: a[i] }); i++ }
  while (j < m) { ops.push({ type: 'add', token: b[j] }); j++ }
  return ops
}

// Coalesce adjacent/overlapping ranges so consecutive changed tokens render as a
// single highlight rather than one box per token.
function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length <= 1) return ranges
  const merged: Range[] = [ranges[0]]
  for (let k = 1; k < ranges.length; k++) {
    const last = merged[merged.length - 1]
    const cur = ranges[k]
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      merged.push(cur)
    }
  }
  return merged
}

// Pathologically long lines (minified bundles) make the LCS table large and the
// highlight meaningless; skip word-diffing them.
const MAX_TOKENS = 400

/**
 * Character ranges that changed, for the old line (`del`) and new line (`add`).
 * Returns empty ranges when the lines share no content — a whole-line background
 * already conveys "entirely different", and highlighting everything is just noise.
 */
export function computeWordRanges(oldStr: string, newStr: string): { del: Range[]; add: Range[] } {
  const a = tokenize(oldStr)
  const b = tokenize(newStr)
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) return { del: [], add: [] }

  const ops = lcsDiff(a, b)
  let commonChars = 0
  for (const op of ops) {
    if (op.type === 'equal') commonChars += op.token.length
  }
  if (commonChars === 0) return { del: [], add: [] }

  const del: Range[] = []
  const add: Range[] = []
  let oldPos = 0
  let newPos = 0
  for (const op of ops) {
    const len = op.token.length
    if (op.type === 'equal') {
      oldPos += len
      newPos += len
    } else if (op.type === 'del') {
      del.push({ start: oldPos, end: oldPos + len })
      oldPos += len
    } else {
      add.push({ start: newPos, end: newPos + len })
      newPos += len
    }
  }
  return { del: mergeRanges(del), add: mergeRanges(add) }
}

const isDel = (t: string): boolean => t === 'delete' || t === 'deleted'
const isAdd = (t: string): boolean => t === 'add' || t === 'added'

/**
 * Given the lines of one hunk, pair each block of deletions with the block of
 * additions immediately following it (index-for-index) and compute the changed
 * ranges. Returns a map from line index → ranges for that line. Lines with no
 * intra-line change (or lone add/delete blocks) are absent from the map.
 */
export function intralineRanges(lines: LineLike[]): Map<number, Range[]> {
  const result = new Map<number, Range[]>()
  let i = 0
  while (i < lines.length) {
    if (!isDel(lines[i].type)) {
      i++
      continue
    }
    const delIdx: number[] = []
    while (i < lines.length && isDel(lines[i].type)) { delIdx.push(i); i++ }
    const addIdx: number[] = []
    while (i < lines.length && isAdd(lines[i].type)) { addIdx.push(i); i++ }

    const pairs = Math.min(delIdx.length, addIdx.length)
    for (let k = 0; k < pairs; k++) {
      const di = delIdx[k]
      const ai = addIdx[k]
      const { del, add } = computeWordRanges(lines[di].content, lines[ai].content)
      if (del.length) result.set(di, del)
      if (add.length) result.set(ai, add)
    }
  }
  return result
}

// Matches a single HTML entity (named or numeric) at the start of the slice.
const ENTITY = /^&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/

/**
 * Overlay highlight spans onto already-highlighted HTML.
 *
 * Walks `html` tracking the visible-character position (tags count as zero, an
 * entity like `&lt;` counts as one). Opens a `<span class={cls}>` when entering a
 * range and closes it when leaving. Crucially, when an HTML tag is encountered
 * mid-range the open span is closed before the tag and reopened after it, so the
 * highlight never straddles a Prism token boundary and the markup stays valid.
 */
export function wrapRanges(html: string, ranges: Range[], cls: string): string {
  if (ranges.length === 0 || html === '') return html
  const open = `<span class="${cls}">`
  let out = ''
  let textPos = 0
  let inMark = false
  let ri = 0
  let i = 0

  const wantMark = (): boolean => {
    while (ri < ranges.length && textPos >= ranges[ri].end) ri++
    return ri < ranges.length && textPos >= ranges[ri].start
  }

  while (i < html.length) {
    if (html[i] === '<') {
      if (inMark) { out += '</span>'; inMark = false }
      const gt = html.indexOf('>', i)
      const end = gt === -1 ? html.length : gt + 1
      out += html.slice(i, end)
      i = end
      continue
    }

    let chunk = html[i]
    if (chunk === '&') {
      const m = ENTITY.exec(html.slice(i))
      if (m) chunk = m[0]
    }

    const want = wantMark()
    if (want && !inMark) { out += open; inMark = true }
    else if (!want && inMark) { out += '</span>'; inMark = false }

    out += chunk
    i += chunk.length
    textPos += 1
  }

  if (inMark) out += '</span>'
  return out
}
