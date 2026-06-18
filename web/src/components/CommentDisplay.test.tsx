import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CommentDisplay from './CommentDisplay'
import type { Comment } from '../types/diff'

function makeComment(over: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    file: 'a.go',
    line: 5,
    lineEnd: 5,
    content: 'rename this variable',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('CommentDisplay', () => {
  it('renders nothing when there are no comments', () => {
    const { container } = render(<CommentDisplay comments={[]} onDelete={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders comment content and a single-line label', () => {
    render(<CommentDisplay comments={[makeComment()]} onDelete={vi.fn()} />)
    expect(screen.getByText('rename this variable')).toBeVisible()
    expect(screen.getByText('Comment on line 5')).toBeVisible()
  })

  it('renders a range label for multi-line comments', () => {
    render(<CommentDisplay comments={[makeComment({ line: 5, lineEnd: 8 })]} onDelete={vi.fn()} />)
    expect(screen.getByText('Comment on lines 5 to 8')).toBeVisible()
  })

  it('exposes an accessible delete button and calls onDelete with the id', () => {
    const onDelete = vi.fn()
    render(<CommentDisplay comments={[makeComment({ id: 'abc' })]} onDelete={onDelete} />)
    const btn = screen.getByRole('button', { name: /Delete comment on line 5/ })
    fireEvent.click(btn)
    expect(onDelete).toHaveBeenCalledWith('abc')
  })

  it('shows an error when deleting fails', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('server down'))
    render(<CommentDisplay comments={[makeComment({ id: 'abc' })]} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /Delete comment/ }))
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/could not delete/i) })
    expect(onDelete).toHaveBeenCalledWith('abc')
  })

  it('has no edit button when onUpdate is not provided', () => {
    render(<CommentDisplay comments={[makeComment()]} onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Edit comment/ })).toBeNull()
  })

  it('edits a comment inline, calls onUpdate, and closes on success', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<CommentDisplay comments={[makeComment({ id: 'abc', content: 'old' })]} onDelete={vi.fn()} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /Edit comment on line 5/ }))
    const textarea = screen.getByRole('textbox', { name: /Edit comment on line 5/ })
    fireEvent.change(textarea, { target: { value: '  updated text  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onUpdate).toHaveBeenCalledWith('abc', 'updated text')
    await waitFor(() => { expect(screen.queryByRole('textbox', { name: /Edit comment on line 5/ })).toBeNull() })
  })

  it('keeps the editor open with an error when the edit fails', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('server down'))
    render(<CommentDisplay comments={[makeComment({ content: 'orig' })]} onDelete={vi.fn()} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /Edit comment/ }))
    const textarea = screen.getByRole('textbox', { name: /Edit comment/ })
    fireEvent.change(textarea, { target: { value: 'new draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/could not save/i) })
    expect(screen.getByRole('textbox', { name: /Edit comment/ })).toHaveValue('new draft')
  })

  it('cancel discards the edit without calling onUpdate', () => {
    const onUpdate = vi.fn()
    render(<CommentDisplay comments={[makeComment({ content: 'keep me' })]} onDelete={vi.fn()} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /Edit comment/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /Edit comment/ }), { target: { value: 'discarded' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('keep me')).toBeInTheDocument()
  })

  it('saves the edit on Ctrl/Cmd+Enter', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<CommentDisplay comments={[makeComment({ id: 'abc' })]} onDelete={vi.fn()} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /Edit comment/ }))
    const textarea = screen.getByRole('textbox', { name: /Edit comment/ })
    fireEvent.change(textarea, { target: { value: 'via keyboard' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    expect(onUpdate).toHaveBeenCalledWith('abc', 'via keyboard')
    await waitFor(() => { expect(screen.queryByRole('textbox', { name: /Edit comment/ })).toBeNull() })
  })

  it('cancels the edit on Escape', () => {
    const onUpdate = vi.fn()
    render(<CommentDisplay comments={[makeComment({ content: 'unchanged' })]} onDelete={vi.fn()} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /Edit comment/ }))
    const textarea = screen.getByRole('textbox', { name: /Edit comment/ })
    fireEvent.change(textarea, { target: { value: 'abandon' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('unchanged')).toBeInTheDocument()
  })
})
