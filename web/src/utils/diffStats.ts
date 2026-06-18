import type { FileDiff } from '../types/diff'

export interface DiffStats {
  files: number
  additions: number
  deletions: number
}

/** Totals the file count and added/deleted line counts across a set of files. */
export function sumDiffStats(files: FileDiff[]): DiffStats {
  return files.reduce<DiffStats>(
    (acc, f) => ({
      files: acc.files + 1,
      additions: acc.additions + f.additions,
      deletions: acc.deletions + f.deletions,
    }),
    { files: 0, additions: 0, deletions: 0 }
  )
}
