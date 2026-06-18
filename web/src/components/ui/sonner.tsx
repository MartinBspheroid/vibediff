import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * App toaster. Colors are driven by our own design tokens (which already flip
 * with the `.dark` class), so it stays in sync with the manual theme toggle
 * without needing to know the current theme. Animations respect reduced motion.
 */
export function Toaster(props: ToasterProps): React.ReactElement {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
        },
      }}
      {...props}
    />
  )
}
