import { describe, it, expect } from 'vitest'
import { useRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'

function Trapped({ active }: { active: boolean }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, active)
  return (
    <div ref={ref}>
      <button>first</button>
      <button>last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('cycles focus from last to first on Tab', () => {
    render(<Trapped active />)
    const last = screen.getByRole('button', { name: 'last' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus()
  })

  it('cycles focus from first to last on Shift+Tab', () => {
    render(<Trapped active />)
    const first = screen.getByRole('button', { name: 'first' })
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus()
  })

  it('does nothing when inactive', () => {
    render(<Trapped active={false} />)
    const last = screen.getByRole('button', { name: 'last' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    // No trapping: focus stays where the browser left it (still 'last' in jsdom).
    expect(last).toHaveFocus()
  })
})
