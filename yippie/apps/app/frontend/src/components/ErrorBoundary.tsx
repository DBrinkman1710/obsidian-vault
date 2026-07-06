import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div>
            <p className="text-slate-700 font-medium">Something went wrong in this section.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-3 rounded bg-slate-800 px-4 py-2 text-sm text-white"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
