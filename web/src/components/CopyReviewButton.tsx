import { toast } from 'sonner'
import type { Comment } from '../types/diff'
import { Button } from '@/components/ui/button'
import { formatCommentsAsText, formatCommentsAsJSON } from '../utils/exportComments'
import { copyText } from '../utils/clipboard'

type Format = 'text' | 'json'

/**
 * Copies all review comments to the clipboard as text or JSON, ready to paste
 * into an AI assistant or tooling. Hidden when there are no comments. Feedback is
 * surfaced as a toast rather than mutating the button label.
 */
export default function CopyReviewButton({ comments }: { comments: Comment[] }): React.ReactElement | null {
  if (comments.length === 0) return null

  const copy = async (format: Format): Promise<void> => {
    const payload = format === 'json' ? formatCommentsAsJSON(comments) : formatCommentsAsText(comments)
    const ok = await copyText(payload)
    if (ok) {
      toast.success(format === 'json' ? 'Review copied as JSON' : 'Review copied as text')
    } else {
      console.error('Failed to copy review to the clipboard')
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="flex">
      <Button
        variant="outline"
        onClick={() => { void copy('text'); }}
        aria-label="Copy review comments as text"
        className="rounded-r-none focus-visible:z-10"
      >
        Copy review ({comments.length})
      </Button>
      <Button
        variant="outline"
        onClick={() => { void copy('json'); }}
        aria-label="Copy review comments as JSON"
        className="rounded-l-none -ml-px focus-visible:z-10"
      >
        JSON
      </Button>
    </div>
  )
}
