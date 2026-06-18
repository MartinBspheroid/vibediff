import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DarkModeToggle from './DarkModeToggle'

describe('DarkModeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to light and exposes an accessible toggle', () => {
    render(<DarkModeToggle />)
    const btn = screen.getByRole('button', { name: /switch to dark mode/i })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles dark mode, updating the document class and localStorage', () => {
    render(<DarkModeToggle />)
    const btn = screen.getByRole('button', { name: /switch to dark mode/i })

    fireEvent.click(btn)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /switch to light mode/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('initializes from a saved theme', () => {
    localStorage.setItem('theme', 'dark')
    render(<DarkModeToggle />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
  })
})
