import { useState, useRef, useEffect } from 'react'
import type { Comment } from '../types/diff'
import { formatCommentsAsText, formatCommentsAsJSON } from '../utils/exportComments'
import { copyText } from '../utils/clipboard'

type Format = 'text' | 'json'

/**
 * Copies all review comments to the clipboard as text or JSON, ready to paste
 * into an AI assistant or tooling. Hidden when there are no comments.
 */
export default function CopyReviewButton({ comments }: { comments: Comment[] }): React.ReactElement | null {
  const [feedback, setFeedback] = useState<{ format: Format; ok: boolean } | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  if (comments.length === 0) return null

  const copy = async (format: Format): Promise<void> => {
    const payload = format === 'json' ? formatCommentsAsJSON(comments) : formatCommentsAsText(comments)
    const ok = await copyText(payload)
    if (!ok) {
      console.error('Failed to copy review to the clipboard')
    }
    setFeedback({ format, ok })
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => { setFeedback(null); }, 2000)
  }

  const label = (format: Format, base: string): string => {
    if (feedback?.format !== format) return base
    return feedback.ok ? 'Copied!' : 'Copy failed'
  }

  const sharedClasses =
    'text-sm font-medium bg-[#fafbfc] dark:bg-[#21262d] text-[#24292e] dark:text-[#c9d1d9] border border-[rgba(27,31,35,.15)] dark:border-[#30363d] transition-colors cursor-pointer hover:bg-[#f3f4f6] dark:hover:bg-[#30363d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0366d6] dark:focus-visible:ring-[#1f6feb] focus-visible:relative focus-visible:z-10'

  return (
    <div className="flex">
      <button
        type="button"
        onClick={() => { void copy('text'); }}
        aria-label="Copy review comments as text"
        className={`${sharedClasses} px-3 py-[5px] rounded-l-md`}
      >
        {label('text', `Copy review (${String(comments.length)})`)}
      </button>
      <button
        type="button"
        onClick={() => { void copy('json'); }}
        aria-label="Copy review comments as JSON"
        className={`${sharedClasses} px-3 py-[5px] rounded-r-md border-l-0`}
      >
        {label('json', 'JSON')}
      </button>
    </div>
  )
}
