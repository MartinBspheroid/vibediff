import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConnectionStatus from './ConnectionStatus'

describe('ConnectionStatus', () => {
  it('renders nothing while connected', () => {
    const { container } = render(<ConnectionStatus connected />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a status message when disconnected', () => {
    render(<ConnectionStatus connected={false} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/live updates paused/i)
  })
})
