import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DialogClose } from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'

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
export default function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps): React.ReactElement {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent showCloseButton={false} className="max-w-[420px]" aria-describedby={undefined}>
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogClose asChild>
            <Button variant="outline" size="sm" aria-label="Close keyboard shortcuts">
              Close
            </Button>
          </DialogClose>
        </DialogHeader>

        <dl className="m-0">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between py-1.5">
              <dt className="text-sm text-foreground">{s.description}</dt>
              <dd className="flex items-center gap-1 m-0">
                {s.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-mono
                      bg-muted text-foreground border border-border rounded
                      shadow-[inset_0_-1px_0_rgba(27,31,35,0.08)]"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
