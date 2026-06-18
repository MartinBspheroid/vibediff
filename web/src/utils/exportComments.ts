import type { Comment } from '../types/diff'

/**
 * Formats review comments as plain text for pasting into an AI assistant,
 * mirroring the terminal output: a `file:line` (or `file:start-end`) locator
 * followed by the comment body, blocks separated by a blank line.
 */
export function formatCommentsAsText(comments: Comment[]): string {
  return comments
    .map((c) => {
      const loc =
        c.lineEnd !== 0 && c.lineEnd !== c.line
          ? `${c.file}:${String(c.line)}-${String(c.lineEnd)}`
          : `${c.file}:${String(c.line)}`
      return `${loc}\n${c.content}`
    })
    .join('\n\n')
}

/** Formats review comments as pretty-printed JSON (mirrors the CLI -format json). */
export function formatCommentsAsJSON(comments: Comment[]): string {
  return JSON.stringify(comments, null, 2)
}
