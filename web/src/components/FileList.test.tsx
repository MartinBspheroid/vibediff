import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FileList from './FileList'
import type { FileDiff } from '../types/diff'

function f(path: string): FileDiff {
  return {
    path,
    status: 'modified',
    additions: 1,
    deletions: 0,
    hunks: [],
  }
}

const files = [f('src/app.ts'), f('README.md')]
const base = {
  files,
  selectedFile: null,
  onSelectFile: vi.fn(),
  displayMode: 'single' as const,
  viewMode: 'list' as const,
  collapsedFolders: new Set<string>(),
  onToggleFolderCollapse: vi.fn(),
}

describe('FileList', () => {
  it('renders files as accessible buttons in list mode and selects on click', () => {
    const onSelectFile = vi.fn()
    render(<FileList {...base} onSelectFile={onSelectFile} />)
    const fileButton = screen.getByRole('button', { name: /src\/app\.ts/ })
    expect(fileButton).toBeInTheDocument()

    fireEvent.click(fileButton)
    expect(onSelectFile).toHaveBeenCalledWith(files[0])
  })

  it('marks the selected file with aria-current', () => {
    render(<FileList {...base} selectedFile={files[0]} />)
    expect(screen.getByRole('button', { name: /src\/app\.ts/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /README\.md/ })).not.toHaveAttribute('aria-current')
  })

  it('renders folders as buttons with aria-expanded in tree mode', () => {
    render(<FileList {...base} viewMode="tree" />)
    const folder = screen.getByRole('button', { name: /folder src/i })
    expect(folder).toHaveAttribute('aria-expanded', 'true')
  })

  it('reflects a collapsed folder via aria-expanded', () => {
    render(<FileList {...base} viewMode="tree" collapsedFolders={new Set(['src'])} />)
    expect(screen.getByRole('button', { name: /folder src/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps deep tree filenames on one truncated line', () => {
    const longPath = 'frontend/apps/broker/src/features/intake-form/components/detail/basic-data-section.tsx'
    render(<FileList {...base} files={[f(longPath)]} viewMode="tree" />)

    const fileName = screen.getByText('basic-data-section.tsx')
    expect(fileName).toHaveAttribute('title', longPath)
    expect(fileName).toHaveClass('truncate')
    expect(screen.getByRole('button', { name: /basic-data-section\.tsx/ })).not.toHaveClass('break-all')
  })

  it('shows a comment-count badge on files that have comments', () => {
    render(<FileList {...base} commentCounts={{ 'src/app.ts': 2 }} />)
    expect(screen.getByLabelText('2 comments')).toBeInTheDocument()
    // README.md has no comments, so no badge.
    expect(screen.queryByLabelText(/comment/)).toBeInTheDocument() // sanity: at least one exists
    expect(screen.queryByLabelText('1 comment')).toBeNull()
  })

  it('shows no badge when a file has no comments', () => {
    render(<FileList {...base} commentCounts={{}} />)
    expect(screen.queryByLabelText(/comments?$/)).toBeNull()
  })
})
