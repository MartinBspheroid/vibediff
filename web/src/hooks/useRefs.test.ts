import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRefs } from './useRefs'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useRefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads refs from the API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'main', type: 'branch', current: true }],
    })
    const { result } = renderHook(() => useRefs())
    await waitFor(() => { expect(result.current).toHaveLength(1) })
    expect(result.current[0].name).toBe('main')
  })

  it('returns an empty list when the request fails', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useRefs())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toEqual([])
  })
})
