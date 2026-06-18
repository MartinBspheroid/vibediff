import { useState, useEffect } from 'react'
import type { Ref } from '../types/diff'

/**
 * Loads the branches and tags the diff can be compared against. Failures are
 * non-fatal (the selector simply shows only the default option).
 */
export function useRefs(): Ref[] {
  const [refs, setRefs] = useState<Ref[]>([])

  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      try {
        const res = await fetch('/api/refs')
        if (!res.ok) return
        const data = await res.json() as Ref[]
        if (active) setRefs(data)
      } catch (err) {
        console.error('Failed to load refs:', err)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  return refs
}
