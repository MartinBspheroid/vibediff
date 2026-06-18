import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TargetSelector from './TargetSelector'
import type { Ref } from '../types/diff'

const refs: Ref[] = [
  { name: 'main', type: 'branch', current: true },
  { name: 'feature/x', type: 'branch', current: false },
  { name: 'v1.0.0', type: 'tag', current: false },
]

describe('TargetSelector', () => {
  it('renders the default option plus branches and tags', () => {
    render(<TargetSelector refs={refs} value="" onChange={vi.fn()} />)
    const select = screen.getByRole('combobox', { name: 'Compare against' })
    expect(select).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Working tree (default)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'main (current)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'feature/x' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'v1.0.0' })).toBeInTheDocument()
  })

  it('calls onChange with the selected ref name', () => {
    const onChange = vi.fn()
    render(<TargetSelector refs={refs} value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Compare against' }), {
      target: { value: 'feature/x' },
    })
    expect(onChange).toHaveBeenCalledWith('feature/x')
  })

  it('reflects the current value', () => {
    render(<TargetSelector refs={refs} value="v1.0.0" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Compare against' })).toHaveValue('v1.0.0')
  })

  it('shows only the default option when there are no refs', () => {
    render(<TargetSelector refs={[]} value="" onChange={vi.fn()} />)
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })
})
