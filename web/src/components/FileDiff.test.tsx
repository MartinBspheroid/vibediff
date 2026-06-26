import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FileDiff from './FileDiff'
import type { FileDiff as FileDiffType } from '../types/diff'

function makeFile(): FileDiffType {
  return {
    path: 'src/app.ts',
    status: 'modified',
    additions: 1,
    deletions: 0,
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 2,
        header: '@@ -1 +1,2 @@',
        lines: [
          { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'const a = 1' },
          { type: 'add', newLineNumber: 2, content: 'const b = 2' },
        ],
      },
    ],
  }
}

const baseProps = {
  file: makeFile(),
  viewMode: 'unified' as const,
  collapsed: false,
  onToggleCollapse: vi.fn(),
  onAddComment: vi.fn(),
  onViewFullFile: vi.fn(),
  getCommentsForLine: () => [],
  onDeleteComment: async () => { /* noop */ },
}

describe('FileDiff', () => {
  it('renders the file path and additions/deletions', () => {
    render(<FileDiff {...baseProps} />)
    expect(screen.getByText('src/app.ts')).toBeVisible()
    expect(screen.getByText('+1')).toBeVisible()
  })

  it('shows a binary-file message instead of a diff for non-image binary files', () => {
    const binary = { ...makeFile(), path: 'data.bin', isBinary: true, hunks: [] }
    render(<FileDiff {...baseProps} file={binary} />)
    expect(screen.getByText(/Binary file/)).toBeVisible()
  })

  it('previews an image binary file as an <img> instead of the message', () => {
    const image: FileDiffType = {
      ...makeFile(),
      path: 'assets/logo.png',
      status: 'added',
      isBinary: true,
      hunks: [],
    }
    render(<FileDiff {...baseProps} file={image} />)
    const img = screen.getByRole('img', { name: /New version of assets\/logo\.png/ })
    expect(img).toHaveAttribute('src', '/api/blob/assets%2Flogo.png?side=new')
    expect(screen.queryByText(/Binary file/)).toBeNull()
  })

  it('shows a status badge', () => {
    render(<FileDiff {...baseProps} />)
    expect(screen.getByText('Modified')).toBeVisible()
  })

  it('shows "renamed from" for a renamed file', () => {
    const renamed = { ...makeFile(), status: 'renamed' as const, oldPath: 'src/old.ts' }
    render(<FileDiff {...baseProps} file={renamed} />)
    expect(screen.getByText('Renamed')).toBeVisible()
    expect(screen.getByText(/renamed from src\/old\.ts/)).toBeVisible()
  })

  it('renders a Viewed checkbox and toggles it when onToggleReviewed is provided', () => {
    const onToggleReviewed = vi.fn()
    render(<FileDiff {...baseProps} isReviewed={false} onToggleReviewed={onToggleReviewed} />)
    const cb = screen.getByRole('checkbox', { name: /viewed/i })
    expect(cb).not.toBeChecked()
    fireEvent.click(cb)
    expect(onToggleReviewed).toHaveBeenCalledTimes(1)
  })

  it('reflects the reviewed state in the checkbox', () => {
    render(<FileDiff {...baseProps} isReviewed onToggleReviewed={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /viewed/i })).toBeChecked()
  })

  it('omits the Viewed checkbox when onToggleReviewed is absent', () => {
    render(<FileDiff {...baseProps} />)
    expect(screen.queryByRole('checkbox', { name: /viewed/i })).toBeNull()
  })

  it('shows a "No content changes" message for a hunkless (pure rename) file', () => {
    const renamed: FileDiffType = {
      ...makeFile(),
      status: 'renamed',
      oldPath: 'src/old.ts',
      additions: 0,
      deletions: 0,
      hunks: [],
    }
    render(<FileDiff {...baseProps} file={renamed} />)
    expect(screen.getByText(/No content changes \(renamed\)/)).toBeVisible()
  })

  it('defers a very large diff behind a "Show diff anyway" button', () => {
    const lines: FileDiffType['hunks'][number]['lines'] = []
    for (let i = 1; i <= 1600; i++) {
      lines.push({ type: 'add', newLineNumber: i, content: `line ${String(i)}` })
    }
    const big: FileDiffType = {
      path: 'huge.txt',
      status: 'modified',
      additions: 1600,
      deletions: 0,
      hunks: [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: 1600, header: '@@', lines }],
    }
    render(<FileDiff {...baseProps} file={big} />)

    // The diff body is not rendered yet; a placeholder + button are shown.
    expect(screen.getByText(/Large diff — 1600 lines/)).toBeInTheDocument()
    expect(screen.queryByText('line 1')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show diff anyway' }))
    // After opting in, the lines render.
    expect(screen.getByText('line 1')).toBeInTheDocument()
  })

  it('renders a normal-sized diff immediately (no large-diff guard)', () => {
    const { container } = render(<FileDiff {...baseProps} />)
    expect(screen.queryByText(/Large diff/)).toBeNull()
    // The diff body table is present (content is syntax-highlighted, so assert
    // the rendered code cell rather than a fragmented text node).
    expect(container.querySelector('td.line-code')).not.toBeNull()
  })

  it('aligns multi-line deletions and additions side-by-side in split view', () => {
    const file: FileDiffType = {
      path: 'src/m.ts',
      status: 'modified',
      additions: 2,
      deletions: 2,
      hunks: [
        {
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 2,
          header: '@@ -1,2 +1,2 @@',
          lines: [
            { type: 'delete', oldLineNumber: 1, content: 'old one' },
            { type: 'delete', oldLineNumber: 2, content: 'old two' },
            { type: 'add', newLineNumber: 1, content: 'new one' },
            { type: 'add', newLineNumber: 2, content: 'new two' },
          ],
        },
      ],
    }
    const { container } = render(<FileDiff {...baseProps} file={file} viewMode="split" />)
    // Both changed lines pair up: each row holds a deletion cell AND an addition
    // cell (the old logic only paired the boundary del/add, giving just one).
    const rows = Array.from(container.querySelectorAll('tr.group'))
    const pairedRows = rows.filter(
      (r) => r.querySelector('.line-code-deletion') && r.querySelector('.line-code-addition')
    )
    expect(pairedRows).toHaveLength(2)
  })
})
