import type { FileDiff } from '../types/diff'

/**
 * Files whose total changed lines exceed this are collapsed by default in
 * "All Files" mode, so a handful of huge (often generated or vendored) diffs
 * don't bury the files a reviewer actually wants to read. The user can expand
 * any collapsed file with a single click, and the choice sticks for the session.
 */
export const LARGE_FILE_CHANGE_THRESHOLD = 500

type FileChangeCounts = Pick<FileDiff, 'additions' | 'deletions'>

/** Total added + deleted lines for a file. */
export function fileChangeCount(file: FileChangeCounts): number {
  return file.additions + file.deletions
}

/** True when a file changes enough lines to be collapsed by default. */
export function isLargeFileDiff(file: FileChangeCounts): boolean {
  return fileChangeCount(file) > LARGE_FILE_CHANGE_THRESHOLD
}
