import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values and supports conditional objects', () => {
    expect(cn('a', false, null, undefined, { b: true, c: false })).toBe('a b')
  })

  it('lets later Tailwind utilities win conflicting ones (tailwind-merge)', () => {
    // Both set padding; the last should win rather than both being emitted.
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('rounded-md', 'rounded-l-none')).toBe('rounded-md rounded-l-none')
  })
})
