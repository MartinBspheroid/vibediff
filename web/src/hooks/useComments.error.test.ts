import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useComments } from './useComments'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useComments - initial load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('surfaces an error when the initial fetch is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => [] })
    const { result } = renderHook(() => useComments())
    await waitFor(() => { expect(result.current.error).toBeTruthy() })
    expect(result.current.comments).toEqual([])
  })

  it('surfaces an error when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useComments())
    await waitFor(() => { expect(result.current.error).toBe('network down') })
  })

  it('clears error and loads comments on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', file: 'a.go', line: 1, lineEnd: 1, content: 'hi', createdAt: '2026-01-01' }],
    })
    const { result } = renderHook(() => useComments())
    await waitFor(() => { expect(result.current.comments).toHaveLength(1) })
    expect(result.current.error).toBeNull()
  })
})
