import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TargetSelector from './TargetSelector'
import type { Ref } from '../types/diff'

const refs: Ref[] = [
  { name: 'main', type: 'branch', current: true },
  { name: 'feature/x', type: 'branch', current: false },
  { name: 'v1.0.0', type: 'tag', current: false },
]

// The dropdown is a Radix Select; its trigger carries role="combobox" and shows
// the label for the current value. Opening it and choosing options is covered by
// the Playwright e2e (Radix's portal + pointer interaction needs a real browser).
describe('TargetSelector', () => {
  it('shows the default label when no target is selected', () => {
    render(<TargetSelector refs={refs} value="" onChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox', { name: 'Compare against' })
    expect(trigger).toHaveTextContent('Working tree (default)')
  })

  it('reflects a selected branch (marking the current one)', () => {
    render(<TargetSelector refs={refs} value="main" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Compare against' })).toHaveTextContent('main (current)')
  })

  it('reflects a selected tag', () => {
    render(<TargetSelector refs={refs} value="v1.0.0" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Compare against' })).toHaveTextContent('v1.0.0')
  })

  it('renders the trigger even when there are no refs', () => {
    render(<TargetSelector refs={[]} value="" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Compare against' })).toHaveTextContent('Working tree (default)')
  })
})
