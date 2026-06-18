import DiffViewer from './components/DiffViewer'
import PrismThemeManager from './components/PrismThemeManager'
import { Toaster } from './components/ui/sonner'
import { WebSocketProvider } from './contexts/WebSocketContext'

function App(): React.ReactElement {
  return (
    <WebSocketProvider>
      <PrismThemeManager />
      <DiffViewer />
      <Toaster />
    </WebSocketProvider>
  )
}

export default App
