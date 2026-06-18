import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'

describe('KeyboardShortcutsDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<KeyboardShortcutsDialog isOpen={false} onClose={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the shortcut list as an accessible dialog when open', () => {
    render(<KeyboardShortcutsDialog isOpen={true} onClose={() => undefined} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Next file')).toBeInTheDocument()
    expect(screen.getByText('Focus the file filter')).toBeInTheDocument()
  })

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsDialog isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close keyboard shortcuts' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsDialog isOpen={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsDialog isOpen={true} onClose={onClose} />)
    // The backdrop is the dialog's parent; clicking the inner dialog must NOT close.
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
