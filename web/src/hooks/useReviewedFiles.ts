import { useState, useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'

const STORAGE_KEY = 'reviewedFiles'

function loadInitial(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'))
    }
  } catch (err) {
    console.error('Failed to read reviewed files:', err)
  }
  return new Set()
}

interface UseReviewedFilesReturn {
  reviewedFiles: Set<string>
  toggleReviewed: (path: string) => void
  isReviewed: (path: string) => boolean
}

/**
 * Tracks which files the user has marked as "viewed" during a review, persisted
 * across reloads in localStorage (keyed by file path).
 */
export function useReviewedFiles(): UseReviewedFilesReturn {
  const [reviewedFiles, setReviewedFiles] = useState<Set<string>>(loadInitial)
  useLocalStorage(STORAGE_KEY, reviewedFiles)

  const toggleReviewed = useCallback((path: string) => {
    setReviewedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const isReviewed = useCallback((path: string) => reviewedFiles.has(path), [reviewedFiles])

  return { reviewedFiles, toggleReviewed, isReviewed }
}
