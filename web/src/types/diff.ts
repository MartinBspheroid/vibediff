export type DiffType = 'all' | 'staged' | 'unstaged'
export type ViewMode = 'unified' | 'split'

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed'

export interface FileDiff {
  path: string
  oldPath?: string
  status: FileStatus
  additions: number
  deletions: number
  isBinary?: boolean
  hunks: Hunk[]
}

export interface Hunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  header: string
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'normal' | 'add' | 'delete' | 'context' | 'added' | 'deleted'
  oldLineNumber?: number
  newLineNumber?: number
  oldNumber?: number
  newNumber?: number
  content: string
  /** True when git marked this line "\ No newline at end of file". */
  noNewline?: boolean
}

export interface DiffResult {
  files: FileDiff[]
  type: DiffType
}

export interface Comment {
  id: string
  file: string
  line: number
  lineEnd: number
  content: string
  createdAt: string
}

export interface Ref {
  name: string
  type: 'branch' | 'tag'
  current: boolean
}
