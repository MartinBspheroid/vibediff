import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CopyReviewButton from './CopyReviewButton'
import type { Comment } from '../types/diff'

const writeText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.clearAllMocks()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

function makeComment(over: Partial<Comment> = {}): Comment {
  return { id: 'c1', file: 'a.go', line: 3, lineEnd: 3, content: 'fix', createdAt: '2026-01-01', ...over }
}

describe('CopyReviewButton', () => {
  it('renders nothing with no comments', () => {
    const { container } = render(<CopyReviewButton comments={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the comment count on the text button', () => {
    render(<CopyReviewButton comments={[makeComment(), makeComment({ id: 'c2' })]} />)
    expect(screen.getByRole('button', { name: /copy review comments as text/i })).toHaveTextContent('Copy review (2)')
  })

  it('copies formatted text and confirms', async () => {
    render(<CopyReviewButton comments={[makeComment({ content: 'rename it' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /as text/i }))

    await waitFor(() => { expect(writeText).toHaveBeenCalledWith('a.go:3\nrename it') })
    await waitFor(() => { expect(screen.getByRole('button', { name: /as text/i })).toHaveTextContent('Copied!') })
  })

  it('copies JSON when the JSON button is used', async () => {
    render(<CopyReviewButton comments={[makeComment()]} />)
    fireEvent.click(screen.getByRole('button', { name: /as json/i }))

    await waitFor(() => { expect(writeText).toHaveBeenCalled() })
    const arg = writeText.mock.calls[0][0] as string
    expect(JSON.parse(arg)).toHaveLength(1)
  })

  it('shows a failure message when both clipboard paths fail', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    vi.spyOn(document, 'execCommand').mockReturnValue(false)
    render(<CopyReviewButton comments={[makeComment()]} />)
    fireEvent.click(screen.getByRole('button', { name: /as text/i }))
    await waitFor(() => { expect(screen.getByRole('button', { name: /as text/i })).toHaveTextContent('Copy failed') })
  })
})
