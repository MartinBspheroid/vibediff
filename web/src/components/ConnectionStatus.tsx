/**
 * A subtle indicator shown only when the live-update WebSocket is disconnected,
 * so users know updates have paused (e.g. after a server restart). Renders
 * nothing while connected — zero noise in the normal case.
 */
export default function ConnectionStatus({ connected }: { connected: boolean }): React.ReactElement | null {
  if (connected) return null
  return (
    <span
      role="status"
      className="flex items-center gap-1.5 text-xs text-amber-300 dark:text-amber-400 whitespace-nowrap"
      title="The connection to the local server dropped. Live updates will resume automatically when it reconnects."
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
      Live updates paused — reconnecting…
    </span>
  )
}
