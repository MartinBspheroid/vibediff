import { useState } from 'react'
import type { FileDiff } from '../types/diff'
import { imageBlobSrc } from '../utils/imageFile'

const CHECKERBOARD =
  'bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] ' +
  '[background-image:linear-gradient(45deg,#e1e4e8_25%,transparent_25%),linear-gradient(-45deg,#e1e4e8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e1e4e8_75%),linear-gradient(-45deg,transparent_75%,#e1e4e8_75%)] ' +
  'dark:[background-image:linear-gradient(45deg,#30363d_25%,transparent_25%),linear-gradient(-45deg,#30363d_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#30363d_75%),linear-gradient(-45deg,transparent_75%,#30363d_75%)]'

interface PaneProps {
  label: string
  labelClass: string
  path: string
  side: 'old' | 'new'
}

function ImagePane({ label, labelClass, path, side }: PaneProps): React.ReactElement {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)

  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <figcaption className={`text-xs font-medium ${labelClass}`}>{label}</figcaption>
      {failed ? (
        <div className="flex items-center justify-center w-[160px] h-[80px] rounded border border-dashed border-[#d1d5da] dark:border-[#30363d] text-xs text-[#586069] dark:text-[#8b949e] italic">
          preview unavailable
        </div>
      ) : (
        <img
          src={imageBlobSrc(path, side)}
          alt={`${side === 'old' ? 'Previous' : 'New'} version of ${path}`}
          onLoad={(e) => { setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); }}
          onError={() => { setFailed(true); }}
          className={`max-w-[320px] max-h-[320px] rounded border border-[#d1d5da] dark:border-[#30363d] ${CHECKERBOARD}`}
        />
      )}
      {dims && !failed && (
        <span className="text-xs text-[#586069] dark:text-[#8b949e] tabular-nums">
          {dims.w} × {dims.h}
        </span>
      )}
    </figure>
  )
}

/**
 * Previews an image binary file as before/after thumbnails instead of the
 * generic "content not shown" message. Which sides are shown depends on the
 * change: added → after only, deleted → before only, modified/renamed → both.
 * Each pane reports its pixel dimensions once loaded and degrades gracefully if
 * the image can't be fetched.
 */
export default function BinaryImagePreview({ file }: { file: FileDiff }): React.ReactElement {
  const showBefore = file.status === 'deleted' || file.status === 'modified' || file.status === 'renamed'
  const showAfter = file.status !== 'deleted'

  return (
    <div className="flex flex-wrap gap-6 p-4">
      {showBefore && (
        <ImagePane label="Before" labelClass="text-[#cf222e] dark:text-[#f85149]" path={file.oldPath ?? file.path} side="old" />
      )}
      {showAfter && (
        <ImagePane label="After" labelClass="text-[#1a7f37] dark:text-[#3fb950]" path={file.path} side="new" />
      )}
    </div>
  )
}
