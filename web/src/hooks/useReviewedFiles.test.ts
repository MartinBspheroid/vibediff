import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReviewedFiles } from './useReviewedFiles'

describe('useReviewedFiles', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    const { result } = renderHook(() => useReviewedFiles())
    expect(result.current.reviewedFiles.size).toBe(0)
    expect(result.current.isReviewed('a.go')).toBe(false)
  })

  it('toggles a file on and off', () => {
    const { result } = renderHook(() => useReviewedFiles())
    act(() => { result.current.toggleReviewed('a.go') })
    expect(result.current.isReviewed('a.go')).toBe(true)
    act(() => { result.current.toggleReviewed('a.go') })
    expect(result.current.isReviewed('a.go')).toBe(false)
  })

  it('persists reviewed files to localStorage', () => {
    const { result } = renderHook(() => useReviewedFiles())
    act(() => { result.current.toggleReviewed('a.go') })
    const stored = JSON.parse(localStorage.getItem('reviewedFiles') ?? '[]') as string[]
    expect(stored).toContain('a.go')
  })

  it('loads previously reviewed files from localStorage', () => {
    localStorage.setItem('reviewedFiles', JSON.stringify(['b.go']))
    const { result } = renderHook(() => useReviewedFiles())
    expect(result.current.isReviewed('b.go')).toBe(true)
  })
})
