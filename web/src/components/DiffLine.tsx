import React, { useMemo } from 'react'
import type { DiffLine as DiffLineType } from '../types/diff'
import { getLanguageFromFilename, highlightCode } from '../utils/prism'
import { wrapRanges, type Range } from '../utils/wordDiff'

interface DiffLineProps {
  line: DiffLineType
  /** The signed line number used for selection/comment keying. */
  lineNumber: number
  viewMode: 'unified' | 'split'
  // Stable handlers (DiffLine binds lineNumber itself) so React.memo can skip
  // re-rendering unaffected lines in large diffs.
  onMouseEnter?: (lineNumber: number) => void
  onDragStart?: (lineNumber: number) => void
  isInSelection?: boolean
  isInCommentRange?: boolean
  filename: string
  wrapLines?: boolean
  // Character ranges within this line that changed vs. its paired line, used to
  // highlight the exact words that differ (intra-line diff). Must be a stable
  // reference (computed once per file) so React.memo can skip unaffected lines.
  intralineRanges?: Range[]
}

// Configuration for line types
const LINE_TYPE_CONFIG = {
  add: { class: 'line-addition', codeClass: 'line-code-addition', prefix: '+' },
  added: { class: 'line-addition', codeClass: 'line-code-addition', prefix: '+' },
  delete: { class: 'line-deletion', codeClass: 'line-code-deletion', prefix: '-' },
  deleted: { class: 'line-deletion', codeClass: 'line-code-deletion', prefix: '-' },
  normal: { class: '', codeClass: '', prefix: ' ' },
  context: { class: '', codeClass: '', prefix: ' ' }
}

// Add Comment Button Component
const AddCommentButton = ({ onDragStart, lineLabel }: { onDragStart?: () => void; lineLabel?: string }): React.ReactElement => (
  <button
    type="button"
    aria-label={lineLabel ? `Add review comment on line ${lineLabel}` : 'Add review comment'}
    onMouseDown={(e) => {
      e.preventDefault()
      onDragStart?.()
    }}
    onClick={(e) => {
      // Keyboard activation (Enter/Space) fires click without a preceding mousedown.
      if (e.detail === 0) {
        onDragStart?.()
      }
    }}
    className="absolute -left-[26px] top-0 w-[22px] h-5 bg-[#0366d6] dark:bg-[#1f6feb] text-white rounded-[3px] text-base leading-5 cursor-pointer p-0 transition-[transform,opacity]
      opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto
      focus-visible:opacity-100 focus-visible:pointer-events-auto
      hover:bg-[#0256c7] dark:hover:bg-[#388bfd] hover:scale-110
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-[#0366d6] dark:focus-visible:ring-offset-[#1f6feb]
      motion-reduce:transition-none motion-reduce:hover:scale-100"
  >
    +
  </button>
)

const DiffLine = React.memo(({
  line,
  lineNumber,
  viewMode,
  onMouseEnter,
  onDragStart,
  isInSelection = false,
  isInCommentRange = false,
  filename,
  wrapLines = false,
  intralineRanges
}: DiffLineProps): React.ReactElement => {
  const config = LINE_TYPE_CONFIG[line.type]
  const isAddition = line.type === 'add' || line.type === 'added'
  const isDeletion = line.type === 'delete' || line.type === 'deleted'
  const lineLabel = String(line.newLineNumber ?? line.newNumber ?? line.oldLineNumber ?? line.oldNumber ?? '')
  const handleMouseEnter = onMouseEnter ? () => { onMouseEnter(lineNumber); } : undefined
  const handleDragStart = onDragStart ? () => { onDragStart(lineNumber); } : undefined

  // Highlight the code content
  const highlightedContent = useMemo(() => {
    const language = getLanguageFromFilename(filename)
    // If content is empty, return empty string
    if (!line.content) {
      return ''
    }
    // Always highlight to preserve formatting
    const html = highlightCode(line.content, language)
    // Overlay intra-line word highlights (if any) on top of the syntax markup.
    if (intralineRanges && intralineRanges.length > 0) {
      const cls = isDeletion ? 'diff-word-del' : 'diff-word-add'
      return wrapRanges(html, intralineRanges, cls)
    }
    return html
  }, [line.content, filename, intralineRanges, isDeletion])

  if (viewMode === 'unified') {
    return (
      <tr
        className={`group font-mono text-xs leading-5 diff-line ${config.class} ${isInSelection ? 'line-selected' : ''} ${isInCommentRange ? 'line-commented-range' : ''}`}
        onMouseEnter={handleMouseEnter}
      >
        {/* Old Line Number */}
        <td className={`line-num w-[50px] min-w-[50px] px-[10px] text-center select-none border-r border-[#e1e4e8] dark:border-[#30363d] ${isDeletion ? 'line-num-deletion' : ''}`}>
          {line.oldLineNumber ?? line.oldNumber ?? ''}
        </td>

        {/* New Line Number */}
        <td className={`line-num w-[50px] min-w-[50px] px-[10px] text-center select-none border-r border-[#e1e4e8] dark:border-[#30363d] ${line.type === 'add' || line.type === 'added' ? 'line-num-addition' : ''}`}>
          {line.newLineNumber ?? line.newNumber ?? ''}
        </td>

        {/* Code Line */}
        <td className={`line-code px-[10px] py-0 relative w-full ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'} ${config.codeClass}`} data-prefix={config.prefix}>
          <code className={`language-${getLanguageFromFilename(filename)}`} dangerouslySetInnerHTML={{ __html: highlightedContent }} />

          <AddCommentButton onDragStart={handleDragStart} lineLabel={lineLabel} />
        </td>
      </tr>
    )
  }

  // Split view
  return (
    <>
      {isDeletion || line.type === 'normal' || line.type === 'context' ? (
        <>
          <td className={`line-num w-[50px] min-w-[50px] px-[10px] text-center select-none border-r border-[#e1e4e8] dark:border-[#30363d] ${isDeletion ? 'line-num-deletion' : ''} ${isInSelection ? 'line-selected' : ''} ${isInCommentRange ? 'line-commented-range' : ''}`}>
            {line.oldLineNumber ?? line.oldNumber ?? ''}
          </td>
          <td className={`line-code px-[10px] py-0 relative border-r-2 border-r-[#e1e4e8] dark:border-r-[#30363d] ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'} ${config.codeClass} ${isInSelection ? 'line-selected' : ''} ${isInCommentRange ? 'line-commented-range' : ''}`} data-prefix={config.prefix} onMouseEnter={handleMouseEnter}>
            <code className={`language-${getLanguageFromFilename(filename)}`} dangerouslySetInnerHTML={{ __html: highlightedContent }} />
            <AddCommentButton onDragStart={handleDragStart} lineLabel={lineLabel} />
          </td>
        </>
      ) : (
        <>
          <td className={`line-num w-[50px] min-w-[50px] px-[10px] text-center select-none border-r border-[#e1e4e8] dark:border-[#30363d] ${isAddition ? 'line-num-addition' : ''} ${isInSelection ? 'line-selected' : ''} ${isInCommentRange ? 'line-commented-range' : ''}`}>
            {line.newLineNumber ?? line.newNumber ?? ''}
          </td>
          <td className={`line-code px-[10px] py-0 relative ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'} ${config.codeClass} ${isInSelection ? 'line-selected' : ''} ${isInCommentRange ? 'line-commented-range' : ''}`} data-prefix={config.prefix} onMouseEnter={handleMouseEnter}>
            <code className={`language-${getLanguageFromFilename(filename)}`} dangerouslySetInnerHTML={{ __html: highlightedContent }} />
            <AddCommentButton onDragStart={handleDragStart} lineLabel={lineLabel} />
          </td>
        </>
      )}
    </>
  )
})

export default DiffLine
