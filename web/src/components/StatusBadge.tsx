import type { FileStatus } from '../types/diff'

const STATUS_CONFIG: Record<FileStatus, { label: string; classes: string }> = {
  added: { label: 'Added', classes: 'bg-[#dafbe1] text-[#1a7f37] dark:bg-[#2ea0431f] dark:text-[#3fb950]' },
  modified: { label: 'Modified', classes: 'bg-[#fff8c5] text-[#9a6700] dark:bg-[#bb80091f] dark:text-[#d29922]' },
  deleted: { label: 'Deleted', classes: 'bg-[#ffebe9] text-[#cf222e] dark:bg-[#f851491f] dark:text-[#f85149]' },
  renamed: { label: 'Renamed', classes: 'bg-[#ddf4ff] text-[#0969da] dark:bg-[#388bfd1f] dark:text-[#58a6ff]' },
}

/** A small colored pill indicating a file's change status. */
export default function StatusBadge({ status }: { status: FileStatus }): React.ReactElement {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}
