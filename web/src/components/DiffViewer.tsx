import { useState, useEffect, useMemo, useRef } from 'react'
import type { DiffType, ViewMode, FileDiff as FileDiffType } from '../types/diff'
import { filterFiles, filterByStatus, type StatusFilter } from '../utils/filterFiles'
import { countCommentsByFile } from '../utils/commentCounts'
import { sumDiffStats } from '../utils/diffStats'
import { useDiff } from '../hooks/useDiff'
import { useComments } from '../hooks/useComments'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRefs } from '../hooks/useRefs'
import { useReviewedFiles } from '../hooks/useReviewedFiles'
import TargetSelector from './TargetSelector'
import CopyReviewButton from './CopyReviewButton'
import { IconList, IconTree, IconCheckCircle, IconDanger, IconKeyboard } from './icons'
import { useWebSocketUpdates } from '../contexts/WebSocketContext'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import FileList from './FileList'
import FileDiff from './FileDiff'
import CommentDialog from './CommentDialog'
import FullFileModal from './FullFileModal'
import DarkModeToggle from './DarkModeToggle'
import ConnectionStatus from './ConnectionStatus'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'

interface DiffViewerProps {
  className?: string
}

// Position classes that visually join shadcn Buttons into a single segmented
// control (shared borders, only the outer corners rounded).
function segItem(index: number, total: number): string {
  const base = 'focus-visible:z-10'
  if (total <= 1) return base
  if (index === 0) return `${base} rounded-r-none`
  if (index === total - 1) return `${base} rounded-l-none -ml-px`
  return `${base} rounded-none -ml-px`
}

export default function DiffViewer({ className = '' }: DiffViewerProps): React.ReactElement {
  const [diffType, setDiffType] = useState<DiffType>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [selectedFile, setSelectedFile] = useState<FileDiffType | null>(null)
  const [displayMode, setDisplayMode] = useState<'single' | 'all'>('single')
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  const [commentDialog, setCommentDialog] = useState<{ file: string; line: number; lineEnd: number } | null>(null)
  const [fullFileModal, setFullFileModal] = useState<string | null>(null)
  const [fileViewMode, setFileViewMode] = useState<'list' | 'tree'>('list')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [wrapLines, setWrapLines] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [target, setTarget] = useState(() => localStorage.getItem('diffTarget') ?? '')

  const refs = useRefs()
  const { reviewedFiles, toggleReviewed, isReviewed } = useReviewedFiles()
  const { data, loading, error, refetch } = useDiff(diffType, target)
  const { comments, error: commentsError, addComment, updateComment, deleteComment, getCommentsForLine, getCommentRangeLines } = useComments()
  const { lastUpdate, connected } = useWebSocketUpdates()

  // Marking a file viewed collapses it (and un-viewing expands it), like GitHub.
  const handleToggleReviewed = (path: string): void => {
    const willReview = !reviewedFiles.has(path)
    toggleReviewed(path)
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (willReview) {
        next.add(path)
      } else {
        next.delete(path)
      }
      return next
    })
  }

  const reviewedCount = data ? data.files.filter((f) => reviewedFiles.has(f.path)).length : 0

  const [fileFilter, setFileFilter] = useState('')
  const fileFilterRef = useRef<HTMLInputElement>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const allFiles = useMemo(() => data?.files ?? [], [data])
  const filteredFiles = useMemo(
    () => filterByStatus(filterFiles(allFiles, fileFilter), statusFilter),
    [allFiles, fileFilter, statusFilter]
  )
  const isFiltering = fileFilter.trim() !== '' || statusFilter !== 'all'
  const commentCounts = useMemo(() => countCommentsByFile(comments), [comments])
  const diffStats = useMemo(() => sumDiffStats(allFiles), [allFiles])
  const allVisibleCollapsed = filteredFiles.length > 0 && filteredFiles.every((f) => collapsedFiles.has(f.path))

  // Refetch when WebSocket triggers an update
  useEffect(() => {
    setIsRefreshing(true)
    refetch()
    // Clear refreshing indicator after a short delay
    const timer = setTimeout(() => { setIsRefreshing(false); }, 500)
    return () => { clearTimeout(timer); }
  }, [lastUpdate, refetch])

  // Load preferences from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('viewMode') as ViewMode | null
    if (savedViewMode !== null) setViewMode(savedViewMode)

    const savedDisplayMode = localStorage.getItem('displayMode') as 'single' | 'all' | null
    if (savedDisplayMode !== null) setDisplayMode(savedDisplayMode)

    const savedCollapsed = localStorage.getItem('collapsedFiles')
    if (savedCollapsed) {
      try {
        setCollapsedFiles(new Set(JSON.parse(savedCollapsed) as string[]))
      } catch (e) {
        console.error('Failed to parse collapsed files', e)
      }
    }

    const savedFileViewMode = localStorage.getItem('sidebarView') as 'list' | 'tree' | null
    if (savedFileViewMode !== null) setFileViewMode(savedFileViewMode)

    const savedCollapsedFolders = localStorage.getItem('collapsedFolders')
    if (savedCollapsedFolders) {
      try {
        setCollapsedFolders(new Set(JSON.parse(savedCollapsedFolders) as string[]))
      } catch (e) {
        console.error('Failed to parse collapsed folders', e)
      }
    }

    const savedWrapLines = localStorage.getItem('wrapLines')
    if (savedWrapLines !== null) setWrapLines(savedWrapLines === 'true')
  }, [])

  // Save preferences using the custom hook
  useLocalStorage('viewMode', viewMode)
  useLocalStorage('displayMode', displayMode)
  useLocalStorage('collapsedFiles', collapsedFiles)
  useLocalStorage('sidebarView', fileViewMode)
  useLocalStorage('collapsedFolders', collapsedFolders)
  useLocalStorage('wrapLines', wrapLines)
  useLocalStorage('diffTarget', target)

  // Self-heal a persisted target that no longer exists (e.g. branch deleted),
  // so we don't keep requesting an invalid ref (which the server rejects).
  useEffect(() => {
    if (target !== '' && refs.length > 0 && !refs.some((r) => r.name === target)) {
      setTarget('')
    }
  }, [refs, target])

  // Auto-select first file when data loads
  useEffect(() => {
    if (data?.files.length && !selectedFile) {
      setSelectedFile(data.files[0])
    } else if (selectedFile && data?.files.length) {
      // Preserve selected file if it still exists
      const stillExists = data.files.find(f => f.path === selectedFile.path)
      if (stillExists) {
        setSelectedFile(stillExists)
      } else {
        // File was deleted, select first file
        setSelectedFile(data.files[0])
      }
    }
  }, [data, selectedFile])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!data?.files.length || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // "?" opens the keyboard-shortcuts help (the dialog handles Escape itself).
      // Match both how real browsers report it (key "?") and the Shift+"/" form
      // some environments report instead.
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }

      // While the help overlay is open, freeze background navigation.
      if (showShortcuts) {
        return
      }

      // "/" jumps to the file filter (common search shortcut).
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault()
        fileFilterRef.current?.focus()
        return
      }

      const currentIndex = selectedFile ? data.files.findIndex(f => f.path === selectedFile.path) : -1

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        const nextIndex = currentIndex + 1
        if (nextIndex < data.files.length) {
          setSelectedFile(data.files[nextIndex])
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        const prevIndex = currentIndex - 1
        if (prevIndex >= 0) {
          setSelectedFile(data.files[prevIndex])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); }
  }, [data, selectedFile, showShortcuts])

  const toggleFileCollapse = (filePath: string): void => {
    setCollapsedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filePath)) {
        newSet.delete(filePath)
      } else {
        newSet.add(filePath)
      }
      return newSet
    })
  }

  // Collapse/expand the currently visible (filtered) files, leaving the
  // collapse state of files hidden by the filter untouched.
  const toggleAllCollapse = (): void => {
    setCollapsedFiles(prev => {
      const next = new Set(prev)
      if (allVisibleCollapsed) {
        filteredFiles.forEach(f => next.delete(f.path))
      } else {
        filteredFiles.forEach(f => next.add(f.path))
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className={`flex justify-center items-center h-screen ${className}`}>
        <div className="text-gray-500 dark:text-gray-400">Loading diff...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex justify-center items-center h-screen ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-screen bg-white dark:bg-[#0d1117] ${viewMode === 'split' ? 'split-view-active' : ''}`}>
      {/* Header - GitHub style dark header */}
      <header className="bg-[#24292e] dark:bg-[#161b22] text-white border-b border-[#e1e4e8] dark:border-[#30363d]">
        <div className="max-w-[1280px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-nowrap">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">VibeDiff</h1>
              {isRefreshing && (
                <span className="text-sm text-gray-300">Updating...</span>
              )}
              <ConnectionStatus connected={connected} />
            </div>
            <div className="flex items-center gap-4 flex-nowrap whitespace-nowrap">
            {/* Compare-against target selector */}
            <TargetSelector refs={refs} value={target} onChange={setTarget} />

            {/* Diff Type Selector */}
            <div className="flex">
              {(['all', 'staged', 'unstaged'] as DiffType[]).map((type, index) => (
                <Button
                  key={type}
                  variant={diffType === type ? 'default' : 'outline'}
                  onClick={() => { setDiffType(type); }}
                  className={segItem(index, 3)}
                >
                  {type === 'all' ? 'All Changes' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex">
              <Button variant={viewMode === 'unified' ? 'default' : 'outline'} onClick={() => { setViewMode('unified'); }} className={segItem(0, 2)}>
                Unified
              </Button>
              <Button variant={viewMode === 'split' ? 'default' : 'outline'} onClick={() => { setViewMode('split'); }} className={segItem(1, 2)}>
                Split
              </Button>
            </div>

            {/* Display Mode Toggle */}
            <div className="flex">
              <Button variant={displayMode === 'single' ? 'default' : 'outline'} onClick={() => { setDisplayMode('single'); }} className={segItem(0, 2)}>
                Single File
              </Button>
              <Button variant={displayMode === 'all' ? 'default' : 'outline'} onClick={() => { setDisplayMode('all'); }} className={segItem(1, 2)}>
                All Files
              </Button>
            </div>

            {/* Collapse All Button */}
            <Button
              variant="outline"
              onClick={toggleAllCollapse}
              disabled={displayMode === 'single'}
              title={displayMode === 'single' ? 'Available in All Files mode' : ''}
            >
              {allVisibleCollapsed ? 'Expand All' : 'Collapse All'}
            </Button>

            {/* Wrap Lines Toggle */}
            <Button variant={wrapLines ? 'default' : 'outline'} onClick={() => { setWrapLines(!wrapLines); }} title="Toggle line wrapping">
              Wrap Lines
            </Button>

            <CopyReviewButton comments={comments} />

            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { setShowShortcuts(true); }}
                    aria-label="Keyboard shortcuts"
                    aria-keyshortcuts="?"
                  >
                    <IconKeyboard aria-hidden="true" className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DarkModeToggle />
            </div>
          </div>
        </div>
      </header>

      {commentsError && (
        <div
          role="alert"
          className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm px-4 py-2 text-center"
        >
          Couldn&apos;t load existing review comments ({commentsError}). New comments will still be saved.
        </div>
      )}

      <div className="flex max-w-[1280px] mx-auto min-h-[calc(100vh-65px)] w-full">
        {/* Sidebar */}
        <div className="w-[260px] bg-[#fafbfc] dark:bg-[#0d1117] border-r border-[#e1e4e8] dark:border-[#30363d] p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#24292e] dark:text-[#c9d1d9]">
              Files changed ({data?.files.length ?? 0})
              {reviewedCount > 0 && (
                <span className="ml-1 font-normal text-[#586069] dark:text-[#8b949e]">
                  · {reviewedCount} viewed
                </span>
              )}
            </h3>
            <Button
              variant="ghost"
              onClick={() => { setFileViewMode(fileViewMode === 'list' ? 'tree' : 'list'); }}
              className="h-auto w-auto p-1 text-muted-foreground hover:text-foreground"
              aria-label={fileViewMode === 'list' ? 'Switch to tree view' : 'Switch to list view'}
              title={fileViewMode === 'list' ? 'Switch to tree view' : 'Switch to list view'}
            >
              {fileViewMode === 'list'
                ? <IconTree aria-hidden="true" className="w-4 h-4" />
                : <IconList aria-hidden="true" className="w-4 h-4" />}
            </Button>
          </div>

          {allFiles.length > 0 && (
            <div
              className="mb-3 text-xs"
              aria-label={`${String(diffStats.additions)} additions and ${String(diffStats.deletions)} deletions across ${String(diffStats.files)} files`}
            >
              <span className="text-[#1a7f37] dark:text-[#2ea043]">+{diffStats.additions}</span>
              {' '}
              <span className="text-[#cf222e] dark:text-[#f85149]">−{diffStats.deletions}</span>
            </div>
          )}

          {/* File filter */}
          {allFiles.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              <Input
                ref={fileFilterRef}
                type="text"
                value={fileFilter}
                onChange={(e) => { setFileFilter(e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setFileFilter('')
                    e.currentTarget.blur()
                  }
                }}
                placeholder="Filter files… (press /)"
                aria-label="Filter files by path"
              />
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); }}>
                <SelectTrigger aria-label="Filter files by status" className="w-full bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="added">Added</SelectItem>
                  <SelectItem value="modified">Modified</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="renamed">Renamed</SelectItem>
                </SelectContent>
              </Select>
              {isFiltering && (
                <p className="text-xs text-[#586069] dark:text-[#8b949e]">
                  {filteredFiles.length} of {allFiles.length} files
                </p>
              )}
            </div>
          )}

          {/* File List */}
          {isFiltering && filteredFiles.length === 0 ? (
            <p className="text-sm text-[#586069] dark:text-[#8b949e]">No files match the current filters.</p>
          ) : (
          <FileList
            files={filteredFiles}
            commentCounts={commentCounts}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            displayMode={displayMode}
            viewMode={fileViewMode}
            collapsedFolders={collapsedFolders}
            onToggleFolderCollapse={(folder) => {
              setCollapsedFolders(prev => {
                const newSet = new Set(prev)
                if (newSet.has(folder)) {
                  newSet.delete(folder)
                } else {
                  newSet.add(folder)
                }
                return newSet
              })
            }}
          />
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white dark:bg-[#0d1117] p-4 overflow-y-auto">
        {(() => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (loading) {
            return (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 dark:text-gray-400">Loading...</p>
              </div>
            )
          }
          if (error) {
            return (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <IconDanger className="w-10 h-10 text-red-500" aria-hidden="true" />
                <p className="text-red-600 dark:text-red-400 font-medium">Couldn&apos;t load the diff</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{error}</p>
              </div>
            )
          }
          if (!data || data.files.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <IconCheckCircle className="w-10 h-10 text-[#2ea44f] dark:text-[#3fb950]" aria-hidden="true" />
                <p className="text-[#24292e] dark:text-[#c9d1d9] font-medium">No changes to display</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                  Your working tree is clean for this view. Edit a file and it&apos;ll appear here automatically.
                </p>
              </div>
            )
          }
          if (displayMode === 'all') {
            return (
          <div className="p-6">
            {filteredFiles.map((file) => (
              <FileDiff
                key={file.path}
                file={file}
                viewMode={viewMode}
                collapsed={collapsedFiles.has(file.path)}
                onToggleCollapse={() => { toggleFileCollapse(file.path); }}
                onAddComment={(line, lineEnd) => { setCommentDialog({ file: file.path, line, lineEnd }); }}
                onViewFullFile={() => { setFullFileModal(file.path); }}
                getCommentsForLine={getCommentsForLine}
                getCommentRangeLines={getCommentRangeLines}
                onDeleteComment={deleteComment}
                onUpdateComment={updateComment}
                wrapLines={wrapLines}
                isReviewed={isReviewed(file.path)}
                onToggleReviewed={() => { handleToggleReviewed(file.path); }}
              />
            ))}
          </div>
            )
          }
          if (selectedFile !== null) {
            return (
          <div className="p-6">
            <FileDiff
              file={selectedFile}
              viewMode={viewMode}
              collapsed={false}
              onToggleCollapse={() => { /* Single file view doesn't collapse */ }}
              onAddComment={(line, lineEnd) => { setCommentDialog({ file: selectedFile.path, line, lineEnd }); }}
              onViewFullFile={() => { setFullFileModal(selectedFile.path); }}
              getCommentsForLine={getCommentsForLine}
              getCommentRangeLines={getCommentRangeLines}
              onDeleteComment={deleteComment}
              onUpdateComment={updateComment}
              wrapLines={wrapLines}
              isReviewed={isReviewed(selectedFile.path)}
              onToggleReviewed={() => { handleToggleReviewed(selectedFile.path); }}
            />
          </div>
            )
          }
          return (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400">Select a file to view changes</p>
            </div>
          )
        })()}
        </div>

      {/* Comment Dialog */}
      <CommentDialog
        isOpen={!!commentDialog}
        file={commentDialog?.file ?? ''}
        line={commentDialog?.line ?? 0}
        lineEnd={commentDialog?.lineEnd ?? 0}
        onSubmit={async (content) => {
          if (commentDialog) {
            // CommentDialog closes on success and surfaces errors itself.
            await addComment(commentDialog.file, commentDialog.line, content, commentDialog.lineEnd)
          }
        }}
        onClose={() => { setCommentDialog(null); }}
      />

      {/* Full File Modal */}
      <FullFileModal
        isOpen={!!fullFileModal}
        filePath={fullFileModal ?? ''}
        target={target}
        onClose={() => { setFullFileModal(null); }}
        viewMode={viewMode}
        getCommentsForLine={getCommentsForLine}
        getCommentRangeLines={getCommentRangeLines}
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
        onAddComment={(file, line, content, lineEnd) => {
          void addComment(file, line, content, lineEnd).catch((err: unknown) => {
            console.error('Failed to add comment:', err)
          })
        }}
        wrapLines={wrapLines}
      />

      <KeyboardShortcutsDialog
        isOpen={showShortcuts}
        onClose={() => { setShowShortcuts(false); }}
      />
      </div>
    </div>
  )
}
