import { useEffect, useRef } from 'react'

interface WSMessage {
  type: string
  timestamp: number
}

export function useWebSocket(onUpdate: () => void, onStatusChange?: (connected: boolean) => void): void {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isConnectingRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  // Per-message update timeouts, tracked so they can be cleared on unmount
  // (otherwise they fire onUpdate after the component is gone).
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Store callbacks in refs to avoid reconnecting when they change.
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    const connectWebSocket = (): void => {
      // Prevent multiple simultaneous connections
      if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      isConnectingRef.current = true

      // Clean up any existing connection
      if (wsRef.current) {
        wsRef.current.close()
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        // WebSocket connected
        isConnectingRef.current = false
        reconnectAttemptsRef.current = 0
        onStatusChangeRef.current?.(true)

        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as WSMessage

          if (data.type === 'connected') {
            // Connected to live updates
          } else if (data.type === 'file_changed' || data.type === 'file_added' || data.type === 'file_deleted') {
            // Trigger update after a short delay to ensure git has finished processing
            const id = setTimeout(() => {
              pendingTimeoutsRef.current.delete(id)
              onUpdateRef.current()
            }, 300)
            pendingTimeoutsRef.current.add(id)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        isConnectingRef.current = false
      }

      ws.onclose = () => {
        // WebSocket disconnected
        isConnectingRef.current = false
        wsRef.current = null
        onStatusChangeRef.current?.(false)

        // Exponential backoff for reconnection
        const baseDelay = 1000
        const maxDelay = 30000
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay)
        reconnectAttemptsRef.current++

        // Reconnecting with exponential backoff
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay)
      }
    }

    // Initial connection
    connectWebSocket()

    // Cleanup
    const pendingTimeouts = pendingTimeoutsRef.current
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      pendingTimeouts.forEach(clearTimeout)
      pendingTimeouts.clear()
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, []) // Empty dependency array - only connect once
}
