import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DialogClose } from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import type { FileDiff, Comment } from '../types/diff'
import FileDiffComponent from './FileDiff'
import CommentDialog from './CommentDialog'

interface FullFileModalProps {
  isOpen: boolean
  filePath: string
  target?: string
  onClose: () => void
  viewMode: 'unified' | 'split'
  getCommentsForLine: (file: string, line: number) => Comment[]
  getCommentRangeLines?: (file: string, lineOrder: number[]) => Set<number>
  onDeleteComment: (id: string) => Promise<void>
  onUpdateComment?: (id: string, content: string) => Promise<void>
  onAddComment: (file: string, line: number, content: string, lineEnd: number) => void
  wrapLines?: boolean
}

export default function FullFileModal({ isOpen, filePath, target = '', onClose, viewMode, getCommentsForLine, getCommentRangeLines, onDeleteComment, onUpdateComment, onAddComment, wrapLines = false }: FullFileModalProps): React.ReactElement {
  const [fileData, setFileData] = useState<FileDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commentDialog, setCommentDialog] = useState<{ line: number; lineEnd: number } | null>(null)

  const fetchFileContent = useCallback(async (signal: AbortSignal): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      // Fetch the file diff with full context (honoring the comparison target).
      const params = new URLSearchParams()
      if (target) {
        params.set('target', target)
      }
      const query = params.toString()
      const response = await fetch(`/api/diff/${encodeURIComponent(filePath)}/full${query ? `?${query}` : ''}`, { signal })
      if (!response.ok) {
        throw new Error('Failed to fetch full file diff')
      }
      const data = await response.json() as FileDiff
      if (signal.aborted) return
      setFileData(data)
    } catch (err) {
      if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return
      }
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      if (!signal.aborted) {
        setLoading(false)
      }
    }
  }, [filePath, target])

  useEffect(() => {
    if (isOpen && filePath) {
      const ac = new AbortController()
      void fetchFileContent(ac.signal)
      // Cancel the request if the modal closes or the file changes mid-flight,
      // preventing a state update on a stale/unmounted modal.
      return () => { ac.abort() }
    }
  }, [isOpen, filePath, fetchFileContent])

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={`flex flex-col gap-0 p-0 h-[90%] ${viewMode === 'split' ? 'w-[95%] max-w-[95%]' : 'w-[90%] max-w-[1200px]'}`}
      >
        <DialogHeader className="px-4 py-4 border-b border-border flex-row items-center justify-between space-y-0">
          <DialogTitle>Full file: {filePath}</DialogTitle>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4" style={{ overscrollBehavior: 'contain' }}>
          {(() => {
            if (loading) {
              return (
                <div className="flex justify-center items-center h-full">
                  <div className="text-muted-foreground">Loading full file...</div>
                </div>
              )
            }
            if (error) {
              return (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-destructive">Error: {error}</p>
                </div>
              )
            }
            if (!fileData) {
              return (
                <div className="flex justify-center items-center h-full">
                  <div className="text-muted-foreground">No diff data available</div>
                </div>
              )
            }
            return (
              <FileDiffComponent
                file={fileData}
                viewMode={viewMode}
                collapsed={false}
                onToggleCollapse={() => { /* Not collapsible in modal */ }}
                onAddComment={(line, lineEnd) => {
                  setCommentDialog({ line, lineEnd })
                }}
                onViewFullFile={() => { /* Already in full view */ }}
                getCommentsForLine={getCommentsForLine}
                getCommentRangeLines={getCommentRangeLines}
                onDeleteComment={onDeleteComment}
                onUpdateComment={onUpdateComment}
                hideViewFullFile={true}
                wrapLines={wrapLines}
              />
            )
          })()}
        </div>
      </DialogContent>
    </Dialog>

    {/* Comment Dialog — rendered as a sibling (its own portal/z-index) so it is
        not nested inside the modal's focus scope, which would otherwise hijack
        focus restoration when the modal closes. */}
    <CommentDialog
      isOpen={!!commentDialog}
      file={filePath}
      line={commentDialog?.line ?? 0}
      lineEnd={commentDialog?.lineEnd ?? 0}
      onSubmit={(content) => {
        if (commentDialog) {
          onAddComment(filePath, commentDialog.line, content, commentDialog.lineEnd)
          setCommentDialog(null)
        }
      }}
      onClose={() => { setCommentDialog(null); }}
    />
    </>
  )
}
