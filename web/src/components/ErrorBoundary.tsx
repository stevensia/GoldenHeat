import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold text-[#e0e0e0]">页面出错了</h2>
          <p className="max-w-md text-sm text-[#777]">
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.hash = '#/'
            }}
            className="action-btn action-btn-primary mt-2 text-sm"
          >
            返回首页
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
