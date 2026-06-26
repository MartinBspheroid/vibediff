import type { Comment, DiffType, Ref, ViewMode } from '../types/diff'
import TargetSelector from './TargetSelector'
import CopyReviewButton from './CopyReviewButton'
import DarkModeToggle from './DarkModeToggle'
import ConnectionStatus from './ConnectionStatus'
import { IconKeyboard, IconSettings } from './icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface DiffToolbarProps {
  refs: Ref[]
  target: string
  onTargetChange: (target: string) => void
  diffType: DiffType
  onDiffTypeChange: (type: DiffType) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  displayMode: 'single' | 'all'
  onDisplayModeChange: (mode: 'single' | 'all') => void
  allVisibleCollapsed: boolean
  onToggleAllCollapse: () => void
  wrapLines: boolean
  onWrapLinesChange: (wrap: boolean) => void
  ignoreWhitespace: boolean
  onIgnoreWhitespaceChange: (ignore: boolean) => void
  contextLines: number
  onContextLinesChange: (lines: number) => void
  comments: Comment[]
  connected: boolean
  isUpdating: boolean
  onShowShortcuts: () => void
}

const DIFF_TYPES = ['all', 'staged', 'unstaged'] as const
const VIEW_MODES = ['unified', 'split'] as const
const DISPLAY_MODES = ['single', 'all'] as const

function segItem(index: number, total: number): string {
  const base = 'focus-visible:z-10'
  if (total <= 1) return base
  if (index === 0) return `${base} rounded-r-none`
  if (index === total - 1) return `${base} rounded-l-none -ml-px`
  return `${base} rounded-none -ml-px`
}

function diffTypeLabel(type: DiffType): string {
  if (type === 'all') return 'All'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Header toolbar for diff scope, display preferences, review export, and app
 * chrome. Keeping this out of DiffViewer makes the data/state component smaller.
 */
export function DiffToolbar({
  refs,
  target,
  onTargetChange,
  diffType,
  onDiffTypeChange,
  viewMode,
  onViewModeChange,
  displayMode,
  onDisplayModeChange,
  allVisibleCollapsed,
  onToggleAllCollapse,
  wrapLines,
  onWrapLinesChange,
  ignoreWhitespace,
  onIgnoreWhitespaceChange,
  contextLines,
  onContextLinesChange,
  comments,
  connected,
  isUpdating,
  onShowShortcuts,
}: DiffToolbarProps): React.ReactElement {
  return (
    <header className="bg-[#24292e] dark:bg-[#161b22] text-white border-b border-[#e1e4e8] dark:border-[#30363d]">
      <div className="app-container px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto flex min-w-[150px] items-center gap-2">
            <h1 className="text-base font-semibold leading-7">VibeDiff</h1>
            {(isUpdating) && (
              <span className="text-xs text-gray-300">Updating...</span>
            )}
            <ConnectionStatus connected={connected} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <TargetSelector refs={refs} value={target} onChange={onTargetChange} compact />

            <div className="flex">
              {DIFF_TYPES.map((type, index) => (
                <Button
                  key={type}
                  size="xs"
                  variant={diffType === type ? 'default' : 'outline'}
                  onClick={() => { onDiffTypeChange(type); }}
                  className={segItem(index, DIFF_TYPES.length)}
                >
                  {diffTypeLabel(type)}
                </Button>
              ))}
            </div>

            <div className="flex">
              {VIEW_MODES.map((mode, index) => (
                <Button
                  key={mode}
                  size="xs"
                  variant={viewMode === mode ? 'default' : 'outline'}
                  onClick={() => { onViewModeChange(mode); }}
                  className={segItem(index, VIEW_MODES.length)}
                >
                  {mode === 'unified' ? 'Unified' : 'Split'}
                </Button>
              ))}
            </div>

            <div className="flex">
              {DISPLAY_MODES.map((mode, index) => (
                <Button
                  key={mode}
                  size="xs"
                  variant={displayMode === mode ? 'default' : 'outline'}
                  onClick={() => { onDisplayModeChange(mode); }}
                  className={segItem(index, DISPLAY_MODES.length)}
                >
                  {mode === 'single' ? 'One' : 'All Files'}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="xs"
              onClick={onToggleAllCollapse}
              disabled={displayMode === 'single'}
              title={displayMode === 'single' ? 'Available in All Files mode' : ''}
            >
              {allVisibleCollapsed ? 'Expand' : 'Collapse'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="xs" aria-label="View options" title="View options">
                  <IconSettings aria-hidden="true" className="h-3.5 w-3.5" />
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Display</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={wrapLines}
                  onCheckedChange={onWrapLinesChange}
                  onSelect={(e) => { e.preventDefault(); }}
                >
                  Wrap lines
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={ignoreWhitespace}
                  onCheckedChange={onIgnoreWhitespaceChange}
                  onSelect={(e) => { e.preventDefault(); }}
                >
                  Ignore whitespace
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Context lines</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={String(contextLines)} onValueChange={(v) => { onContextLinesChange(Number(v)); }}>
                  <DropdownMenuRadioItem value="3">3 lines</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="10">10 lines</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="25">25 lines</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="100000">Full file</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <CopyReviewButton comments={comments} compact />

            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="iconSm"
                    onClick={onShowShortcuts}
                    aria-label="Keyboard shortcuts"
                    aria-keyshortcuts="?"
                  >
                    <IconKeyboard aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DarkModeToggle compact />
          </div>
        </div>
      </div>
    </header>
  )
}
