import { useState } from 'react'
import type { Comment } from '../types/diff'
import { Button } from '@/components/ui/button'
import { IconTrash, IconPencil } from './icons'

interface CommentDisplayProps {
  comments: Comment[]
  onDelete: (id: string) => void | Promise<void>
  onUpdate?: (id: string, content: string) => void | Promise<void>
}

function rangeLabel(comment: Comment): string {
  return comment.lineEnd !== comment.line
    ? `lines ${String(Math.abs(comment.line))} to ${String(Math.abs(comment.lineEnd))}`
    : `line ${String(Math.abs(comment.line))}`
}

export default function CommentDisplay({ comments, onDelete, onUpdate }: CommentDisplayProps): React.ReactElement | null {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteErrorId, setDeleteErrorId] = useState<string | null>(null)

  if (comments.length === 0) return null

  const handleDelete = (id: string): void => {
    setDeleteErrorId(null)
    void Promise.resolve(onDelete(id)).catch(() => { setDeleteErrorId(id) })
  }

  const startEdit = (comment: Comment): void => {
    setEditingId(comment.id)
    setDraft(comment.content)
    setEditError(null)
  }

  const cancelEdit = (): void => {
    setEditingId(null)
    setDraft('')
    setEditError(null)
    setSaving(false)
  }

  const saveEdit = (id: string): void => {
    const trimmed = draft.trim()
    if (trimmed === '' || saving) return
    if (!onUpdate) {
      cancelEdit()
      return
    }
    setSaving(true)
    setEditError(null)
    // Close only on success; on failure keep the editor open with the draft.
    void Promise.resolve(onUpdate(id, trimmed))
      .then(() => { cancelEdit() })
      .catch(() => { setEditError('Could not save your changes. Try again.') })
      .finally(() => { setSaving(false) })
  }

  // Match the add-comment dialog's shortcuts: Esc cancels, Cmd/Ctrl+Enter saves.
  const handleEditorKeyDown = (e: React.KeyboardEvent, id: string): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      saveEdit(id)
    }
  }

  return (
    <div className="px-6 py-2 bg-[#f6f8fa] dark:bg-[#161b22] border-t border-b border-[#dfe2e5] dark:border-[#30363d]">
      {comments.map(comment => {
        const isEditing = editingId === comment.id
        return (
          <div key={comment.id} data-comment-id={comment.id} className="bg-white dark:bg-[#0d1117] border border-[#d1d5da] dark:border-[#30363d] rounded-md p-2 my-1 relative">
            <div className="flex justify-between items-center pb-1 mb-1 border-b border-[#e1e4e8] dark:border-[#30363d]">
              <div className="text-xs text-[#586069] dark:text-[#8b949e]">
                Comment on {rangeLabel(comment)}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-[#586069] dark:text-[#8b949e] whitespace-nowrap">
                  {new Date(comment.createdAt).toLocaleString()}
                </div>
                {onUpdate && !isEditing && (
                  <Button
                    variant="ghost"
                    onClick={() => { startEdit(comment); }}
                    aria-label={`Edit comment on ${rangeLabel(comment)}`}
                    className="h-5 w-5 p-0 text-[rgba(27,31,35,.55)] dark:text-[rgba(139,148,158,.65)] hover:text-[#0366d6] dark:hover:text-[#58a6ff] hover:bg-transparent"
                    title="Edit comment"
                  >
                    <IconPencil aria-hidden="true" className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => { handleDelete(comment.id); }}
                  aria-label={`Delete comment on ${rangeLabel(comment)}`}
                  className="h-5 w-5 p-0 text-[rgba(27,31,35,.55)] dark:text-[rgba(139,148,158,.65)] hover:text-[#d73a49] dark:hover:text-[#f85149] hover:bg-transparent"
                  title="Delete comment"
                >
                  <IconTrash aria-hidden="true" className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {deleteErrorId === comment.id && (
              <p role="alert" className="text-xs text-[#cf222e] dark:text-[#f85149] mb-1">
                Could not delete this comment. Try again.
              </p>
            )}
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); if (editError) setEditError(null); }}
                  onKeyDown={(e) => { handleEditorKeyDown(e, comment.id); }}
                  aria-label={`Edit comment on ${rangeLabel(comment)}`}
                  className="w-full px-2 py-1 border border-[#e1e4e8] dark:border-[#30363d] rounded-md text-sm resize-vertical
                    bg-white dark:bg-[#0d1117] text-[#24292e] dark:text-[#c9d1d9]
                    focus:outline-none focus:border-[#0366d6] dark:focus:border-[#1f6feb] focus:shadow-[0_0_0_3px_rgba(3,102,214,0.1)] dark:focus:shadow-[0_0_0_3px_rgba(31,111,235,0.1)]"
                  style={{ minHeight: '60px' }}
                />
                {editError && (
                  <p role="alert" className="text-xs text-[#cf222e] dark:text-[#f85149]">{editError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { saveEdit(comment.id); }}
                    disabled={draft.trim() === '' || saving}
                    className="text-white bg-[#2ea44f] hover:bg-[#2c974b] dark:bg-[#238636] dark:hover:bg-[#2ea043] focus-visible:ring-[#2ea44f]"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm leading-[1.5] font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Helvetica,Arial,sans-serif]">
                {comment.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
