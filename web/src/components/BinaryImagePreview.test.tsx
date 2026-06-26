import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BinaryImagePreview from './BinaryImagePreview'
import type { FileDiff } from '../types/diff'

function makeImage(over: Partial<FileDiff> = {}): FileDiff {
  return { path: 'logo.png', status: 'modified', additions: 0, deletions: 0, isBinary: true, hunks: [], ...over }
}

describe('BinaryImagePreview', () => {
  it('shows both before and after panes for a modified image', () => {
    render(<BinaryImagePreview file={makeImage()} />)
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Previous version of logo\.png/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /New version of logo\.png/ })).toBeInTheDocument()
  })

  it('shows only the after pane for an added image', () => {
    render(<BinaryImagePreview file={makeImage({ status: 'added' })} />)
    expect(screen.queryByText('Before')).toBeNull()
    expect(screen.getByText('After')).toBeInTheDocument()
  })

  it('shows only the before pane for a deleted image', () => {
    render(<BinaryImagePreview file={makeImage({ status: 'deleted' })} />)
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.queryByText('After')).toBeNull()
  })

  it('uses the old path for the before pane of a renamed image', () => {
    render(<BinaryImagePreview file={makeImage({ status: 'renamed', path: 'b.png', oldPath: 'a.png' })} />)
    expect(screen.getByRole('img', { name: /Previous version of a\.png/ })).toHaveAttribute(
      'src',
      '/api/blob/a.png?side=old'
    )
  })

  it('reports pixel dimensions once an image loads', () => {
    render(<BinaryImagePreview file={makeImage({ status: 'added' })} />)
    const img = screen.getByRole('img', { name: /New version of logo\.png/ })
    Object.defineProperty(img, 'naturalWidth', { value: 32, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 24, configurable: true })
    fireEvent.load(img)
    expect(screen.getByText('32 × 24')).toBeInTheDocument()
  })

  it('degrades to a "preview unavailable" note when an image fails to load', () => {
    render(<BinaryImagePreview file={makeImage({ status: 'added' })} />)
    fireEvent.error(screen.getByRole('img', { name: /New version of logo\.png/ }))
    expect(screen.getByText('preview unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /New version of logo\.png/ })).toBeNull()
  })
})
