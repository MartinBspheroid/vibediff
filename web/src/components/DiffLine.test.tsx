import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DiffLine from './DiffLine'
import type { DiffLine as DiffLineType } from '../types/diff'

// A filename with no known extension maps to plaintext, so highlightCode leaves
// the content as plain text (findable via getByText).
const FILENAME = 'notes.txt'

describe('DiffLine', () => {
  it('renders an added line (unified) with content, line number, and a labelled comment button', () => {
    const line: DiffLineType = { type: 'add', newLineNumber: 5, content: 'hello world' }
    render(
      <table>
        <tbody>
          <DiffLine line={line} lineNumber={5} viewMode="unified" onMouseEnter={vi.fn()} filename={FILENAME} />
        </tbody>
      </table>
    )
    expect(screen.getByText('hello world')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add review comment on line 5/ })).toBeInTheDocument()
  })

  it('shows a "no newline" marker when the line lacks a trailing newline', () => {
    const line: DiffLineType = { type: 'delete', oldLineNumber: 2, content: 'bravo', noNewline: true }
    render(
      <table>
        <tbody>
          <DiffLine line={line} lineNumber={-2} viewMode="unified" filename={FILENAME} />
        </tbody>
      </table>
    )
    expect(screen.getByTitle('No newline at end of file')).toBeInTheDocument()
  })

  it('omits the "no newline" marker for a normal line', () => {
    const line: DiffLineType = { type: 'add', newLineNumber: 2, content: 'bravo' }
    render(
      <table>
        <tbody>
          <DiffLine line={line} lineNumber={2} viewMode="unified" filename={FILENAME} />
        </tbody>
      </table>
    )
    expect(screen.queryByTitle('No newline at end of file')).toBeNull()
  })

  it('calls onDragStart with the line number when the comment button is used', () => {
    const onDragStart = vi.fn()
    const line: DiffLineType = { type: 'add', newLineNumber: 7, content: 'x' }
    render(
      <table>
        <tbody>
          <DiffLine line={line} lineNumber={7} viewMode="unified" onDragStart={onDragStart} filename={FILENAME} />
        </tbody>
      </table>
    )
    // Keyboard activation (click with detail 0) triggers onDragStart.
    fireEvent.click(screen.getByRole('button', { name: /Add review comment on line 7/ }), { detail: 0 })
    expect(onDragStart).toHaveBeenCalledWith(7)
  })

  it('renders a context line in split view', () => {
    const line: DiffLineType = { type: 'context', oldLineNumber: 2, newLineNumber: 2, content: 'unchanged' }
    render(
      <table>
        <tbody>
          <tr>
            <DiffLine line={line} lineNumber={2} viewMode="split" onMouseEnter={vi.fn()} filename={FILENAME} />
          </tr>
        </tbody>
      </table>
    )
    expect(screen.getByText('unchanged')).toBeInTheDocument()
  })

  it('fires onMouseEnter with the line number when hovering a split-view cell (range selection)', () => {
    const onMouseEnter = vi.fn()
    const line: DiffLineType = { type: 'context', oldLineNumber: 4, newLineNumber: 4, content: 'ctx' }
    render(
      <table>
        <tbody>
          <tr>
            <DiffLine line={line} lineNumber={4} viewMode="split" onMouseEnter={onMouseEnter} filename={FILENAME} />
          </tr>
        </tbody>
      </table>
    )
    const cell = screen.getByText('ctx').closest('td')
    expect(cell).not.toBeNull()
    if (cell) {
      fireEvent.mouseEnter(cell)
    }
    expect(onMouseEnter).toHaveBeenCalledWith(4)
  })
})
