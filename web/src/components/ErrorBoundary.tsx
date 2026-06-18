import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors in the subtree and shows a recoverable fallback
 * instead of an unmounted (blank) app. React error boundaries must be class
 * components.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center bg-white dark:bg-[#0d1117]"
        >
          <h1 className="text-xl font-semibold text-[#24292e] dark:text-[#c9d1d9]">Something went wrong</h1>
          <p className="text-sm text-[#586069] dark:text-[#8b949e] max-w-md">
            VibeDiff hit an unexpected error while rendering. Your review comments are kept on the server.
          </p>
          <pre className="max-w-md overflow-auto rounded-md bg-[#f6f8fa] dark:bg-[#161b22] p-3 text-left text-xs text-[#cf222e] dark:text-[#f85149]">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => { window.location.reload(); }}
            className="px-4 py-[5px] text-sm font-medium text-white bg-[#2ea44f] hover:bg-[#2c974b] dark:bg-[#238636] dark:hover:bg-[#2ea043] rounded-md transition-colors cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ea44f] focus-visible:ring-offset-1"
          >
            Reload VibeDiff
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
