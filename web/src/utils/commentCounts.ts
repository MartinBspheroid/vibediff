import type { Comment } from '../types/diff'

/** Counts how many review comments target each file, keyed by file path. */
export function countCommentsByFile(comments: Comment[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of comments) {
    counts[c.file] = (counts[c.file] ?? 0) + 1
  }
  return counts
}
