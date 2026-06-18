import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CommentDialogProps {
  isOpen: boolean
  file: string
  line: number
  lineEnd: number
  onSubmit: (content: string) => void | Promise<void>
  onClose: () => void
}

export default function CommentDialog({ isOpen, file, line, lineEnd, onSubmit, onClose }: CommentDialogProps): React.ReactElement {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Reset on both open and close. Clearing on close matters because Radix keeps
    // the content mounted through its exit animation; a lingering textarea still
    // holding the submitted text would otherwise duplicate it in the DOM.
    setContent('')
    setError(null)
    setSubmitting(false)
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
    // Enter submits; Shift+Enter inserts a newline. Escape is handled by Radix.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const rangeLabel = `${String(Math.abs(line))}${lineEnd !== line ? `-${String(Math.abs(lineEnd))}` : ''}`

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="z-[2000] w-[480px] max-w-[90%]"
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => { e.preventDefault(); textareaRef.current?.focus() }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-2">
            <DialogTitle>Add comment on {file}:{rangeLabel}</DialogTitle>
          </DialogHeader>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); if (error) setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Leave a comment"
            aria-label={`Comment on ${file} line ${rangeLabel}`}
            className="w-full px-2 py-2 border border-input rounded-md text-sm
              bg-background text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring
              resize-vertical mb-2"
            style={{ minHeight: '100px', fontFamily: 'inherit' }}
          />

          {error && (
            <p role="alert" className="text-sm text-destructive mb-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!content.trim() || submitting}
              className="bg-[#2ea44f] hover:bg-[#2c974b] text-white dark:bg-[#238636] dark:hover:bg-[#2ea043] border border-[rgba(27,31,35,.15)] dark:border-[rgba(240,246,252,.1)] focus-visible:ring-[#2ea44f] dark:focus-visible:ring-[#2ea043]"
            >
              {submitting ? 'Saving…' : 'Comment'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to submit, Esc to cancel
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
