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

  it('shows a binary-file message instead of a diff for binary files', () => {
    const binary = { ...makeFile(), isBinary: true, hunks: [] }
    render(<FileDiff {...baseProps} file={binary} />)
    expect(screen.getByText(/Binary file/)).toBeVisible()
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
})
