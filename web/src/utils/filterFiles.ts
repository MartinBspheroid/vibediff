import type { FileDiff, FileStatus } from '../types/diff'

export type StatusFilter = 'all' | FileStatus

/**
 * Filters files to those whose path contains the query (case-insensitive).
 * An empty or whitespace-only query returns all files unchanged.
 */
export function filterFiles(files: FileDiff[], query: string): FileDiff[] {
  const q = query.trim().toLowerCase()
  if (q === '') return files
  return files.filter((f) => f.path.toLowerCase().includes(q))
}

/** Filters files by change status. 'all' returns every file unchanged. */
export function filterByStatus(files: FileDiff[], status: StatusFilter): FileDiff[] {
  if (status === 'all') return files
  return files.filter((f) => f.status === status)
}
