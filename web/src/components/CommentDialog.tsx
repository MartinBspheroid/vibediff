import { useState, useEffect, useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface CommentDialogProps {
  isOpen: boolean
  file: string
  line: number
  lineEnd: number
  onSubmit: (content: string) => void | Promise<void>
  onClose: () => void
}

export default function CommentDialog({ isOpen, file, line, lineEnd, onSubmit, onClose }: CommentDialogProps): React.ReactElement | null {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    // Fresh state on each open, and restore focus to the trigger on close.
    setContent('')
    setError(null)
    setSubmitting(false)
    previouslyFocused.current = document.activeElement as HTMLElement | null
    textareaRef.current?.focus()
    return () => {
      previouslyFocused.current?.focus()
    }
  }, [isOpen])

  const handleSubmit = (e: React.SyntheticEvent): void => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setError(null)
    void Promise.resolve(onSubmit(trimmed))
      .then(() => { onClose() })
      .catch(() => {
        setError('Could not save your comment. Check the connection and try again.')
      })
      .finally(() => { setSubmitting(false) })
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Keep keyboard focus inside the dialog while it is open.
  useFocusTrap(dialogRef, isOpen)

  if (!isOpen) return null

  const rangeLabel = `${String(Math.abs(line))}${lineEnd !== line ? `-${String(Math.abs(lineEnd))}` : ''}`

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(0,0,0,0.5)] dark:bg-[rgba(1,4,9,0.8)]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-dialog-title"
        className="bg-white dark:bg-[#161b22] rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.12)] w-[480px] max-w-[90%]"
        onClick={(e) => { e.stopPropagation(); }}
      >
        <form onSubmit={handleSubmit} className="p-4">
          <h3 id="comment-dialog-title" className="text-base font-semibold text-[#24292e] dark:text-[#c9d1d9] mb-2">
            Add comment on {file}:{rangeLabel}
          </h3>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); if (error) setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Leave a comment"
            aria-label={`Comment on ${file} line ${rangeLabel}`}
            className="w-full px-2 py-2 border border-[#e1e4e8] dark:border-[#30363d] rounded-md text-sm
              bg-white dark:bg-[#0d1117] text-[#24292e] dark:text-[#c9d1d9]
              placeholder-[#6a737d] dark:placeholder-[#8b949e]
              focus:outline-none focus:border-[#0366d6] dark:focus:border-[#1f6feb] focus:shadow-[0_0_0_3px_rgba(3,102,214,0.1)] dark:focus:shadow-[0_0_0_3px_rgba(31,111,235,0.1)]
              resize-vertical mb-2"
            style={{ minHeight: '100px', fontFamily: 'inherit' }}
          />

          {error && (
            <p role="alert" className="text-sm text-[#cf222e] dark:text-[#f85149] mb-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-[5px] text-sm font-medium bg-[#fafbfc] dark:bg-[#21262d] text-[#24292e] dark:text-[#c9d1d9]
                border border-[rgba(27,31,35,.15)] dark:border-[#30363d] rounded-md
                hover:bg-[#f3f4f6] dark:hover:bg-[#30363d] transition-colors cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0366d6] dark:focus-visible:ring-[#1f6feb] focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#161b22]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="px-4 py-[5px] text-sm font-medium text-white
                bg-[#2ea44f] hover:bg-[#2c974b] disabled:bg-[#94d3a2] dark:bg-[#238636] dark:hover:bg-[#2ea043] dark:disabled:bg-[#238636]/50
                border border-[rgba(27,31,35,.15)] dark:border-[rgba(240,246,252,.1)] rounded-md transition-colors disabled:cursor-not-allowed
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ea44f] dark:focus-visible:ring-[#2ea043] focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#161b22]"
            >
              {submitting ? 'Saving…' : 'Comment'}
            </button>
          </div>

          <p className="text-xs text-[#586069] dark:text-[#8b949e] mt-2">
            Press Enter to submit, Esc to cancel
          </p>
        </form>
      </div>
    </div>
  )
}
