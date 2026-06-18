import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useComments } from './useComments'

const mockFetch = vi.fn()
global.fetch = mockFetch

const seeded = { id: '1', file: 'a.go', line: 1, lineEnd: 1, content: 'old', createdAt: '2026-01-01' }

describe('useComments - updateComment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PUTs and updates local state on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [seeded] }) // initial load
    const { result } = renderHook(() => useComments())
    await waitFor(() => { expect(result.current.comments).toHaveLength(1) })

    mockFetch.mockResolvedValueOnce({ ok: true }) // PUT
    await act(async () => { await result.current.updateComment('1', 'new') })

    expect(result.current.comments[0].content).toBe('new')
    const putCall = mockFetch.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')
    expect(putCall?.[0]).toBe('/api/review/comment/1')
  })

  it('throws and leaves state unchanged on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [seeded] })
    const { result } = renderHook(() => useComments())
    await waitFor(() => { expect(result.current.comments).toHaveLength(1) })

    mockFetch.mockResolvedValueOnce({ ok: false })
    await expect(result.current.updateComment('1', 'x')).rejects.toThrow()
    expect(result.current.comments[0].content).toBe('old')
  })
})
