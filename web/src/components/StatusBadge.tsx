import type { FileStatus } from '../types/diff'
import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<FileStatus, string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
}

/** A small colored pill indicating a file's change status. */
export default function StatusBadge({ status }: { status: FileStatus }): React.ReactElement {
  return (
    <Badge variant={status} className="px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
      {STATUS_LABEL[status]}
    </Badge>
  )
}
