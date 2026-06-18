import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge'
import type { FileStatus } from '../types/diff'

describe('StatusBadge', () => {
  it('renders a label for each status', () => {
    const cases: [FileStatus, string][] = [
      ['added', 'Added'],
      ['modified', 'Modified'],
      ['deleted', 'Deleted'],
      ['renamed', 'Renamed'],
    ]
    for (const [status, label] of cases) {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })
})
