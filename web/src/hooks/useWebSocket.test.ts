import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static OPEN = 1
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  readyState = 0
  url: string
  close = vi.fn(() => { this.readyState = 3 })
  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function latest(): MockWebSocket {
    const ws = MockWebSocket.instances.at(-1)
    if (!ws) throw new Error('no WebSocket created')
    return ws
  }

  it('calls onUpdate ~300ms after a file_changed message', () => {
    const onUpdate = vi.fn()
    renderHook(() => { useWebSocket(onUpdate) })
    act(() => { latest().onopen?.() })
    act(() => { latest().onmessage?.({ data: JSON.stringify({ type: 'file_changed' }) }) })

    expect(onUpdate).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(300) })
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not call onUpdate after unmount (pending timeout cleared)', () => {
    const onUpdate = vi.fn()
    const { unmount } = renderHook(() => { useWebSocket(onUpdate) })
    act(() => { latest().onopen?.() })
    act(() => { latest().onmessage?.({ data: JSON.stringify({ type: 'file_changed' }) }) })

    unmount()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('ignores the initial "connected" message', () => {
    const onUpdate = vi.fn()
    renderHook(() => { useWebSocket(onUpdate) })
    act(() => { latest().onopen?.() })
    act(() => { latest().onmessage?.({ data: JSON.stringify({ type: 'connected' }) }) })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('reports connection status: true on open, false on close', () => {
    const onStatus = vi.fn()
    renderHook(() => { useWebSocket(vi.fn(), onStatus) })

    act(() => { latest().onopen?.() })
    expect(onStatus).toHaveBeenLastCalledWith(true)

    act(() => { latest().onclose?.() })
    expect(onStatus).toHaveBeenLastCalledWith(false)
  })
})
