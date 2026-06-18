import { createContext, useContext, useState, useCallback } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

interface WebSocketContextType {
  lastUpdate: number
  triggerUpdate: () => void
  connected: boolean
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function WebSocketProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  // Optimistic default avoids a "paused" flash before the first connection.
  const [connected, setConnected] = useState(true)

  const triggerUpdate = useCallback(() => {
    setLastUpdate(Date.now())
  }, [])

  // Set up WebSocket connection at root level
  useWebSocket(triggerUpdate, setConnected)

  return (
    <WebSocketContext.Provider value={{ lastUpdate, triggerUpdate, connected }}>
      {children}
    </WebSocketContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWebSocketUpdates(): WebSocketContextType {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketUpdates must be used within WebSocketProvider')
  }
  return context
}
