import { useState, useEffect, useCallback, useRef } from 'react'
import type { DiffResult, DiffType } from '../types/diff'

interface UseDiffReturn {
  data: DiffResult | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useDiff(type: DiffType = 'all', target = '', ignoreWhitespace = false, contextLines = 3): UseDiffReturn {
  const [data, setData] = useState<DiffResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Tracks the in-flight request so a newer fetch can cancel an older one,
  // preventing a slow earlier response from overwriting newer data.
  const abortRef = useRef<AbortController | null>(null)

  // Shared fetch logic with optional loading state. Each call cancels the
  // previous in-flight request; only the latest request applies its result and
  // clears the loading flag, so a stale response can neither overwrite newer
  // data nor strand the UI in a loading state.
  const fetchDiff = useCallback(async (showLoading = true): Promise<void> => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    if (showLoading) {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams({ type })
      if (target) {
        params.set('target', target)
      }
      if (ignoreWhitespace) {
        params.set('w', '1')
      }
      // Only send a non-default context to keep request URLs clean.
      if (contextLines !== 3) {
        params.set('context', String(contextLines))
      }
      const response = await fetch(`/api/diff?${params.toString()}`, { signal: ac.signal })
      if (!response.ok) {
        throw new Error('Failed to fetch diff')
      }
      const result = await response.json() as DiffResult
      if (ac.signal.aborted) {
        return
      }
      setData(result)
      setError(null)
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return
      }
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      // Only the most recent request owns the loading flag.
      if (abortRef.current === ac) {
        setLoading(false)
      }
    }
  }, [type, target, ignoreWhitespace, contextLines])

  // Initial fetch
  useEffect(() => {
    void fetchDiff(true)
  }, [fetchDiff])

  // Abort any in-flight request on unmount.
  useEffect(() => () => { abortRef.current?.abort() }, [])

  // Refetch without loading state
  const refetch = useCallback((): void => {
    void fetchDiff(false)
  }, [fetchDiff])

  return { data, loading, error, refetch }
}
