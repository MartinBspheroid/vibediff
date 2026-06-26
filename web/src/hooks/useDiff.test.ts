import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDiff } from './useDiff'
import type { DiffType } from '../types/diff'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads diff data on mount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ files: [{ path: 'a.go' }], type: 'all' }),
    })
    const { result } = renderHook(() => useDiff('all'))
    await waitFor(() => { expect(result.current.loading).toBe(false) })
    expect(result.current.data?.files).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('includes the comparison target in the request URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ files: [], type: 'all' }),
    })
    renderHook(() => useDiff('all', 'feature/x'))
    await waitFor(() => { expect(mockFetch).toHaveBeenCalled() })
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('target=feature%2Fx')
  })

  it('requests ignore-whitespace and a non-default context in the URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ files: [], type: 'all' }),
    })
    renderHook(() => useDiff('all', '', true, 25))
    await waitFor(() => { expect(mockFetch).toHaveBeenCalled() })
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('w=1')
    expect(url).toContain('context=25')
  })

  it('omits the context param when it is the default (3)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ files: [], type: 'all' }),
    })
    renderHook(() => useDiff('all', '', false, 3))
    await waitFor(() => { expect(mockFetch).toHaveBeenCalled() })
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).not.toContain('context=')
    expect(url).not.toContain('w=1')
  })

  it('aborts the previous request when the diff type changes', async () => {
    const signals: AbortSignal[] = []
    mockFetch.mockImplementation(async (_url: string, opts: { signal: AbortSignal }) => {
      signals.push(opts.signal)
      // Never resolves; we only care that the stale request is aborted.
      return new Promise<Response>(() => { /* pending */ })
    })

    const { rerender } = renderHook(({ t }: { t: DiffType }) => useDiff(t), {
      initialProps: { t: 'all' as DiffType },
    })
    await waitFor(() => { expect(signals).toHaveLength(1) })
    expect(signals[0].aborted).toBe(false)

    rerender({ t: 'staged' as DiffType })
    await waitFor(() => { expect(signals).toHaveLength(2) })
    // The first (now stale) request must have been aborted.
    expect(signals[0].aborted).toBe(true)
  })

  it('does not surface an error when a request is aborted', async () => {
    mockFetch.mockImplementation(async (_url: string, opts: { signal: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    )
    const { rerender, result } = renderHook(({ t }: { t: DiffType }) => useDiff(t), {
      initialProps: { t: 'all' as DiffType },
    })
    rerender({ t: 'unstaged' as DiffType })
    // Give the aborted promise a tick to reject.
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.error).toBeNull()
  })
})
