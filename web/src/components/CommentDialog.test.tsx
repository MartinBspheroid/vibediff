import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CommentDialog from './CommentDialog'

const base = { isOpen: true, file: 'a.go', line: 3, lineEnd: 3 }

describe('CommentDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CommentDialog {...base} isOpen={false} onSubmit={vi.fn()} onClose={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('is an accessible, labelled modal', () => {
    render(<CommentDialog {...base} onSubmit={vi.fn()} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/a\.go:3/)
  })

  it('focuses the textarea on open', () => {
    render(<CommentDialog {...base} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText('Leave a comment')).toHaveFocus()
  })

  it('disables submit until there is non-whitespace content', () => {
    render(<CommentDialog {...base} onSubmit={vi.fn()} onClose={vi.fn()} />)
    const submit = screen.getByRole('button', { name: 'Comment' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('Leave a comment'), { target: { value: '   ' } })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('Leave a comment'), { target: { value: 'fix' } })
    expect(submit).toBeEnabled()
  })

  it('submits trimmed content on Enter (without Shift) and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<CommentDialog {...base} onSubmit={onSubmit} onClose={onClose} />)
    const ta = screen.getByPlaceholderText('Leave a comment')
    fireEvent.change(ta, { target: { value: '  rename this  ' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('rename this')
    await waitFor(() => { expect(onClose).toHaveBeenCalled() })
  })

  it('keeps the content and shows an error when the submit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('server down'))
    const onClose = vi.fn()
    render(<CommentDialog {...base} onSubmit={onSubmit} onClose={onClose} />)
    const ta = screen.getByPlaceholderText('Leave a comment')
    fireEvent.change(ta, { target: { value: 'keep me' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }))

    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/could not save/i) })
    expect(onClose).not.toHaveBeenCalled()
    expect(ta).toHaveValue('keep me')
  })

  it('does not submit on Shift+Enter', () => {
    const onSubmit = vi.fn()
    render(<CommentDialog {...base} onSubmit={onSubmit} onClose={vi.fn()} />)
    const ta = screen.getByPlaceholderText('Leave a comment')
    fireEvent.change(ta, { target: { value: 'line one' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<CommentDialog {...base} onSubmit={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(screen.getByPlaceholderText('Leave a comment'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a range in the title for multi-line comments', () => {
    render(<CommentDialog {...base} lineEnd={7} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/a\.go:3-7/)
  })
})
