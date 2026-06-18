import React, { useMemo, useCallback, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { FileDiff as FileDiffType, ViewMode, DiffLine as DiffLineType, Comment } from '../types/diff'
import DiffLine from './DiffLine'
import CommentDisplay from './CommentDisplay'
import { useRangeSelection } from '../hooks/useRangeSelection'
import { intralineRanges } from '../utils/wordDiff'
import { IconChevronRight, IconChevronDown } from './icons'
import StatusBadge from './StatusBadge'

interface SplitViewLineResult {
  line: React.ReactNode
  comments: Comment[]
  lineNumber: number
}

interface FileDiffProps {
  file: FileDiffType
  viewMode: ViewMode
  collapsed: boolean
  onToggleCollapse: () => void
  onAddComment: (line: number, lineEnd: number) => void
  onViewFullFile: () => void
  getCommentsForLine: (file: string, line: number) => Comment[]
  getCommentRangeLines?: (file: string, lineOrder: number[]) => Set<number>
  onDeleteComment: (id: string) => Promise<void>
  onUpdateComment?: (id: string, content: string) => Promise<void>
  hideViewFullFile?: boolean
  wrapLines?: boolean
  isReviewed?: boolean
  onToggleReviewed?: () => void
}

export default function FileDiff({
  file,
  viewMode,
  collapsed,
  onToggleCollapse,
  onAddComment,
  onViewFullFile,
  getCommentsForLine,
  getCommentRangeLines,
  onDeleteComment,
  onUpdateComment,
  hideViewFullFile = false,
  wrapLines = false,
  isReviewed = false,
  onToggleReviewed
}: FileDiffProps): React.ReactElement {
  const lineOrder = useMemo(() =>
    file.hunks.flatMap(hunk =>
      hunk.lines.map(line => {
        const isDel = line.type === 'delete' || line.type === 'deleted'
        return isDel
          ? -(line.oldLineNumber ?? line.oldNumber ?? 0)
          : (line.newLineNumber ?? line.newNumber ?? 0)
      })
    ), [file.hunks])

  const commentRangeLines = useMemo(() =>
    getCommentRangeLines ? getCommentRangeLines(file.path, lineOrder) : new Set<number>()
  , [getCommentRangeLines, file.path, lineOrder])

  // Word-level changed ranges, one map (line index → ranges) per hunk. Computed
  // once per file so the per-line arrays stay referentially stable for memo.
  const wordRanges = useMemo(
    () => file.hunks.map(hunk => intralineRanges(hunk.lines)),
    [file.hunks]
  )

  const handleSelect = useCallback((line: number, lineEnd: number) => {
    onAddComment(line, lineEnd)
  }, [onAddComment])

  const { handleDragStart, handleDragEnter, selectedLines } = useRangeSelection({
    lineOrder,
    onSelect: handleSelect
  })

  const reviewedId = useId()

  return (
    <div id={`file-${file.path.replace(/\//g, '-')}`} className="border border-[#d1d5da] dark:border-[#30363d] rounded-md mb-4">
      {/* File Header */}
      <div
        className="bg-[#f6f8fa] dark:bg-[#161b22] px-4 py-[10px] border-b border-[#d1d5da] dark:border-[#30363d] flex items-center justify-between gap-2 cursor-pointer select-none"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Button
            variant="ghost"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${file.path}`}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            className="h-auto w-auto p-0.5 -ml-0.5 text-muted-foreground"
          >
            {collapsed
              ? <IconChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
              : <IconChevronDown aria-hidden="true" className="w-3.5 h-3.5" />}
          </Button>

          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-2 ${isReviewed ? 'opacity-60' : ''}`}>
              <StatusBadge status={file.status} />
              <span className="text-sm font-semibold text-foreground font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Helvetica,Arial,sans-serif]">
                {file.path}
              </span>
            </span>
            {file.status === 'renamed' && file.oldPath && (
              <span className="text-xs text-muted-foreground block">
                renamed from {file.oldPath}
              </span>
            )}
          </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#1a7f37] dark:text-[#2ea043]">+{file.additions}</span>
            <span className="text-[#cf222e] dark:text-[#f85149]">-{file.deletions}</span>
          </div>

          {onToggleReviewed && (
            <div
              className="flex items-center gap-1.5 text-xs select-none text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <Checkbox
                id={reviewedId}
                checked={isReviewed}
                onCheckedChange={() => { onToggleReviewed(); }}
              />
              <label htmlFor={reviewedId} className="cursor-pointer">Viewed</label>
            </div>
          )}

          {!hideViewFullFile && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onViewFullFile(); }}
            >
              View full file
            </Button>
          )}
        </div>
        </div>
      </div>

      {/* Diff Content */}
      {!collapsed && file.isBinary && (
        <div className="px-4 py-3 text-sm text-[#586069] dark:text-[#8b949e] italic">
          Binary file — content not shown.
        </div>
      )}
      {!collapsed && !file.isBinary && (
        <div className="overflow-x-auto">
          {viewMode === 'unified' ? (
            <table className="diff-table w-full">
              <tbody>
                {file.hunks.map((hunk, hunkIndex) => (
                  <React.Fragment key={hunkIndex}>
                    {/* Hunk Header */}
                    <tr>
                      <td colSpan={3} className="px-[10px] py-1 text-xs font-mono text-left" style={{ backgroundColor: 'var(--color-hunk-bg)', color: 'var(--color-hunk-text)' }}>
                        {hunk.header}
                      </td>
                    </tr>

                    {/* Diff Lines */}
                    {hunk.lines.map((line, lineIndex) => {
                      const lineNumber = (line.type === 'delete' || line.type === 'deleted')
                        ? -(line.oldLineNumber ?? line.oldNumber ?? 0)
                        : (line.newLineNumber ?? line.newNumber ?? 0)
                      const comments = getCommentsForLine(file.path, lineNumber)

                      return (
                        <React.Fragment key={`${String(hunkIndex)}-${String(lineIndex)}`}>
                          <DiffLine
                            line={line}
                            viewMode="unified"
                            lineNumber={lineNumber}
                            onMouseEnter={handleDragEnter}
                            onDragStart={handleDragStart}
                            isInSelection={selectedLines.has(lineNumber)}
                            isInCommentRange={commentRangeLines.has(lineNumber)}
                            filename={file.path}
                            wrapLines={wrapLines}
                            intralineRanges={wordRanges[hunkIndex].get(lineIndex)}
                          />
                          {comments.length > 0 && (
                            <tr>
                              <td colSpan={3} className="p-0">
                                <CommentDisplay
                                  comments={comments}
                                  onDelete={onDeleteComment}
                                  onUpdate={onUpdateComment}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="split-diff-table w-full">
              <tbody>
                {file.hunks.map((hunk, hunkIndex) => (
                  <React.Fragment key={hunkIndex}>
                    {/* Hunk Header */}
                    <tr>
                      <td colSpan={4} className="px-[10px] py-1 text-xs font-mono text-left" style={{ backgroundColor: 'var(--color-hunk-bg)', color: 'var(--color-hunk-text)' }}>
                        {hunk.header}
                      </td>
                    </tr>

                    {/* Split View Lines */}
                    {renderSplitView(hunk.lines, (line, index) => {
                      const lineNumber = (line.type === 'delete' || line.type === 'deleted')
                        ? -(line.oldLineNumber ?? line.oldNumber ?? 0)
                        : (line.newLineNumber ?? line.newNumber ?? 0)
                      const comments = getCommentsForLine(file.path, lineNumber)

                      return {
                        line: (
                          <DiffLine
                            key={`${String(hunkIndex)}-${String(index)}`}
                            line={line}
                            viewMode="split"
                            lineNumber={lineNumber}
                            onMouseEnter={handleDragEnter}
                            onDragStart={handleDragStart}
                            isInSelection={selectedLines.has(lineNumber)}
                            isInCommentRange={commentRangeLines.has(lineNumber)}
                            filename={file.path}
                            wrapLines={wrapLines}
                            intralineRanges={wordRanges[hunkIndex].get(index)}
                          />
                        ),
                        comments,
                        lineNumber
                      }
                    }, onDeleteComment, onUpdateComment)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function renderSplitView(lines: DiffLineType[], renderLine: (line: DiffLineType, index: number) => SplitViewLineResult, onDeleteComment: (id: string) => Promise<void>, onUpdateComment?: (id: string, content: string) => Promise<void>): React.ReactNode[] {
  const rows: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.type === 'normal' || line.type === 'context') {
      // Context line appears on both sides
      const result = renderLine(line, i)
      rows.push(
        <tr key={i} className="group">
          {result.line}
          {result.line}
        </tr>
      )
      // Add comment row if there are comments
      if (result.comments.length > 0) {
        rows.push(
          <tr key={`${String(i)}-comment`}>
            <td colSpan={4} className="p-0">
              <CommentDisplay
                comments={result.comments}
                onDelete={onDeleteComment}
                onUpdate={onUpdateComment}
              />
            </td>
          </tr>
        )
      }
      i++
    } else if (line.type === 'delete' || line.type === 'deleted') {
      // Check if next line is an add (change)
      const nextLine = i + 1 < lines.length ? lines[i + 1] : undefined
      if (nextLine?.type === 'add' || nextLine?.type === 'added') {
        // Changed line
        const deleteResult = renderLine(line, i)
        const addResult = renderLine(nextLine, i + 1)
        rows.push(
          <tr key={i} className="group">
            {deleteResult.line}
            {addResult.line}
          </tr>
        )
        // Add comment rows for both sides if needed
        if (deleteResult.comments.length > 0 || addResult.comments.length > 0) {
          rows.push(
            <tr key={`${String(i)}-comment`}>
              <td colSpan={2} className="p-0">
                {deleteResult.comments.length > 0 && (
                  <CommentDisplay
                    comments={deleteResult.comments}
                    onDelete={onDeleteComment}
                    onUpdate={onUpdateComment}
                  />
                )}
              </td>
              <td colSpan={2} className="p-0">
                {addResult.comments.length > 0 && (
                  <CommentDisplay
                    comments={addResult.comments}
                    onDelete={onDeleteComment}
                    onUpdate={onUpdateComment}
                  />
                )}
              </td>
            </tr>
          )
        }
        i += 2
      } else {
        // Deleted line only
        const result = renderLine(line, i)
        rows.push(
          <tr key={i} className="group">
            {result.line}
            <td colSpan={2} className="bg-gray-50 dark:bg-gray-900/50"></td>
          </tr>
        )
        // Add comment row if there are comments
        if (result.comments.length > 0) {
          rows.push(
            <tr key={`${String(i)}-comment`}>
              <td colSpan={2} className="p-0">
                <CommentDisplay
                  comments={result.comments}
                  onDelete={onDeleteComment}
                  onUpdate={onUpdateComment}
                />
              </td>
              <td colSpan={2} className="bg-gray-50 dark:bg-gray-900/50"></td>
            </tr>
          )
        }
        i++
      }
    } else {
      // Added line only (not part of a change)
      const result = renderLine(line, i)
      rows.push(
        <tr key={i} className="group">
          <td colSpan={2} className="bg-gray-50 dark:bg-gray-900/50"></td>
          {result.line}
        </tr>
      )
      // Add comment row if there are comments
      if (result.comments.length > 0) {
        rows.push(
          <tr key={`${String(i)}-comment`}>
            <td colSpan={2} className="bg-gray-50 dark:bg-gray-900/50"></td>
            <td colSpan={2} className="p-0">
              <CommentDisplay
                comments={result.comments}
                onDelete={onDeleteComment}
                onUpdate={onUpdateComment}
              />
            </td>
          </tr>
        )
      }
      i++
    }
  }

  return rows
}
