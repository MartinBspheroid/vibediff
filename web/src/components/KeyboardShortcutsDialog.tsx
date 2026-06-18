import { useEffect, useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface KeyboardShortcutsDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface Shortcut {
  keys: string[]
  description: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['j', '↓'], description: 'Next file' },
  { keys: ['k', '↑'], description: 'Previous file' },
  { keys: ['/'], description: 'Focus the file filter' },
  { keys: ['?'], description: 'Show this help' },
  { keys: ['Esc'], description: 'Close dialogs / clear the filter' },
]

/** A modal listing the app's keyboard shortcuts, opened with `?`. */
export default function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  useFocusTrap(dialogRef, isOpen)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); }
  }, [isOpen, onClose])

  // Move focus into the dialog on open and restore it to the trigger on close.
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    return () => { previouslyFocused?.focus() }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[rgba(0,0,0,0.5)] dark:bg-[rgba(0,0,0,0.8)] p-8"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="bg-white dark:bg-[#0d1117] rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.12)] w-full max-w-[420px] flex flex-col"
        onClick={(e) => { e.stopPropagation(); }}
      >
        <div className="px-4 py-3 border-b border-[#e1e4e8] dark:border-[#30363d] flex items-center justify-between">
          <h3 id="shortcuts-dialog-title" className="text-base font-semibold text-[#24292e] dark:text-[#c9d1d9]">
            Keyboard shortcuts
          </h3>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="px-3 py-[3px] text-xs font-medium bg-[#fafbfc] dark:bg-[#21262d] text-[#24292e] dark:text-[#c9d1d9]
              border border-[rgba(27,31,35,.15)] dark:border-[#30363d] rounded-md
              hover:bg-[#f3f4f6] dark:hover:bg-[#30363d] transition-colors cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0366d6] dark:focus-visible:ring-[#1f6feb]"
          >
            Close
          </button>
        </div>

        <dl className="px-4 py-3 m-0">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between py-1.5">
              <dt className="text-sm text-[#24292e] dark:text-[#c9d1d9]">{s.description}</dt>
              <dd className="flex items-center gap-1 m-0">
                {s.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-mono
                      bg-[#f6f8fa] dark:bg-[#21262d] text-[#24292e] dark:text-[#c9d1d9]
                      border border-[#d1d5da] dark:border-[#30363d] rounded
                      shadow-[inset_0_-1px_0_rgba(27,31,35,0.08)]"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
