import { useMemo } from 'react'
import type { FileDiff } from '../types/diff'
import { IconChevronRight, IconChevronDown, IconChat } from './icons'

interface FileListProps {
  files: FileDiff[]
  selectedFile: FileDiff | null
  onSelectFile: (file: FileDiff) => void
  displayMode: 'single' | 'all'
  viewMode: 'list' | 'tree'
  collapsedFolders: Set<string>
  onToggleFolderCollapse: (folder: string) => void
  commentCounts?: Record<string, number>
}

interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children: TreeNode[]
  file?: FileDiff
}

/** A small "N comments" badge shown on files that have review comments. */
function CommentBadge({ count }: { count: number }): React.ReactElement | null {
  if (count <= 0) return null
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] text-[#586069] dark:text-[#8b949e]"
      aria-label={`${String(count)} comment${count === 1 ? '' : 's'}`}
      title={`${String(count)} comment${count === 1 ? '' : 's'}`}
    >
      <IconChat aria-hidden="true" className="w-3 h-3" />
      {count}
    </span>
  )
}

function sortTreeNode(node: TreeNode): TreeNode {
  const children = [...node.children.map((child) => child.type === 'folder' ? sortTreeNode(child) : child)]
    .sort((a: TreeNode, b: TreeNode) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name)
      }
      return a.type === 'folder' ? -1 : 1
    })

  return { ...node, children }
}

function buildTree(files: FileDiff[]): TreeNode {
  const root: TreeNode = { name: 'root', path: '', type: 'folder', children: [] }

  files.forEach(file => {
    const parts = file.path.split('/')
    let currentNode = root

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i]
      const folderPath = parts.slice(0, i + 1).join('/')

      let folder = currentNode.children.find(
        child => child.type === 'folder' && child.name === folderName
      )

      if (!folder) {
        folder = {
          name: folderName,
          path: folderPath,
          type: 'folder',
          children: []
        }
        currentNode.children.push(folder)
      }

      currentNode = folder
    }

    currentNode.children.push({
      name: parts[parts.length - 1],
      path: file.path,
      type: 'file',
      children: [],
      file
    })
  })

  return sortTreeNode(root)
}

function indentClass(depth: number): string {
  const classes = [
    'pl-2',
    'pl-4',
    'pl-6',
    'pl-8',
    'pl-10',
    'pl-12',
    'pl-14',
    'pl-16',
    'pl-20',
    'pl-24',
  ] as const

  return classes[Math.min(depth, classes.length - 1)]
}

function itemClass(selected: boolean): string {
  return `w-full min-w-0 text-left bg-transparent border border-transparent flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-[13px] overflow-hidden transition-colors
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0366d6] dark:focus-visible:ring-[#1f6feb]
    ${selected
      ? 'bg-[#ddf4ff] text-[#0969da] border-[#54aeff]/45 dark:bg-[#1f6feb]/20 dark:text-[#79c0ff] dark:border-[#388bfd]/35'
      : 'text-[#24292e] dark:text-[#c9d1d9] hover:bg-[#f0f3f6] dark:hover:bg-[rgba(255,255,255,0.05)]'
    }`
}

export default function FileList({ files, selectedFile, onSelectFile, displayMode, viewMode, collapsedFolders, onToggleFolderCollapse, commentCounts = {} }: FileListProps): React.ReactElement {
  const tree = useMemo(() => buildTree(files), [files])

  const handleFileClick = (file: FileDiff): void => {
    onSelectFile(file)

    if (displayMode === 'all') {
      // Scroll to the file in the main view
      const element = document.getElementById(`file-${file.path.replace(/\//g, '-')}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  if (viewMode === 'tree') {
    const renderTreeNode = (node: TreeNode, depth = 0): React.ReactElement | null => {
      if (node.type === 'file' && node.file) {
        const file = node.file
        return (
          <button
            key={node.path}
            type="button"
            onClick={() => { handleFileClick(file); }}
            aria-current={selectedFile?.path === node.file.path ? 'true' : undefined}
            className={`${itemClass(selectedFile?.path === node.file.path)} ${indentClass(depth)}`}
          >
            <span className="flex-1 min-w-0 truncate" title={node.file.path}>{node.name}</span>
            <span className="flex items-center gap-1.5 text-xs flex-shrink-0">
              <CommentBadge count={commentCounts[node.file.path] ?? 0} />
              <span className="text-[#1a7f37] dark:text-[#2ea043]">+{node.file.additions}</span>
              <span className="text-[#cf222e] dark:text-[#f85149]">-{node.file.deletions}</span>
            </span>
          </button>
        )
      }

      if (node.type === 'folder') {
        const isCollapsed = collapsedFolders.has(node.path)
        return (
          <div key={node.path} className="mb-0.5">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} folder ${node.name}`}
              className={`w-full min-w-0 text-left bg-transparent border border-transparent flex items-center pr-2 py-1 rounded-[3px] cursor-pointer select-none text-[#24292e] dark:text-[#c9d1d9] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0366d6] dark:focus-visible:ring-[#1f6feb]
                ${indentClass(depth)}`}
              onClick={() => {
                onToggleFolderCollapse(node.path)
              }}
            >
              <span className="mr-1.5 text-[#586069] dark:text-[#8b949e] inline-flex items-center w-3">
                {isCollapsed
                  ? <IconChevronRight aria-hidden="true" className="w-3 h-3" />
                  : <IconChevronDown aria-hidden="true" className="w-3 h-3" />}
              </span>
              <span className="min-w-0 truncate font-medium text-sm" title={node.path}>{node.name}</span>
            </button>
            {!isCollapsed && node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )
      }

      return null
    }

    return (
      <div className="flex flex-col gap-0.5">
        {tree.children.map(child => renderTreeNode(child, 0))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {files.map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={() => { handleFileClick(file); }}
          aria-current={selectedFile?.path === file.path ? 'true' : undefined}
          className={itemClass(selectedFile?.path === file.path)}
        >
          <span className="flex-1 min-w-0 truncate" title={file.path}>{file.path}</span>
          <span className="flex items-center gap-1.5 text-xs flex-shrink-0">
            <CommentBadge count={commentCounts[file.path] ?? 0} />
            <span className="text-[#1a7f37] dark:text-[#2ea043]">+{file.additions}</span>
            <span className="text-[#cf222e] dark:text-[#f85149]">-{file.deletions}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
