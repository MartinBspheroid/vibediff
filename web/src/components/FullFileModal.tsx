import { useEffect, useState, useCallback, useRef } from 'react'
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

export default function FullFileModal({ isOpen, filePath, target = '', onClose, viewMode, getCommentsForLine, getCommentRangeLines, onDeleteComment, onUpdateComment, onAddComment, wrapLines = false }: FullFileModalProps): React.ReactElement | null {
  const [fileData, setFileData] = useState<FileDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commentDialog, setCommentDialog] = useState<{ line: number; lineEnd: number } | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

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

  const handleKeyDown = useCallback((e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleKeyDown])

  // Move focus into the dialog on open and restore it to the trigger on close.
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.5)] dark:bg-[rgba(0,0,0,0.8)] p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-file-modal-title"
        className={`bg-white dark:bg-[#0d1117] rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.12)] w-[90%] h-[90%] flex flex-col ${viewMode === 'split' ? 'max-w-[95%] w-[95%]' : 'max-w-[1200px]'}`}
        onClick={(e) => { e.stopPropagation(); }}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-[#e1e4e8] dark:border-[#30363d] flex items-center justify-between">
          <h3 id="full-file-modal-title" className="text-base font-semibold text-[#24292e] dark:text-[#c9d1d9]">
            Full file: {filePath}
          </h3>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="px-3 py-[3px] text-xs font-medium bg-[#fafbfc] dark:bg-[#21262d] text-[#24292e] dark:text-[#c9d1d9]
              border border-[rgba(27,31,35,.15)] dark:border-[#30363d] rounded-md
              hover:bg-[#f3f4f6] dark:hover:bg-[#30363d] transition-colors cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0366d6] dark:focus-visible:ring-[#1f6feb]"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4" style={{ overscrollBehavior: 'contain' }}>
          {(() => {
            if (loading) {
              return (
                <div className="flex justify-center items-center h-full">
                  <div className="text-[#586069] dark:text-[#8b949e]">Loading full file...</div>
                </div>
              )
            }
            if (error) {
              return (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-600 dark:text-red-400">Error: {error}</p>
                </div>
              )
            }
            if (!fileData) {
              return (
                <div className="flex justify-center items-center h-full">
                  <div className="text-[#586069] dark:text-[#8b949e]">No diff data available</div>
                </div>
              )
            }
            return (
              <div className="p-4">
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
              </div>
            )
          })()}
        </div>
      </div>

      {/* Comment Dialog */}
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
    </div>
  )
}
