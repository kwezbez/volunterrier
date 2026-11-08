import { Component, type ReactNode } from 'react'

/** keeps one broken widget from blanking the whole app */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error(error)
  }
  render() {
    if (this.state.error)
      return (
        this.props.fallback ?? (
          <div role="alert" className="m-6 rounded-xl bg-surface p-6 text-center">
            <p className="text-lg font-bold">Something went wrong on this page.</p>
            <p className="mt-1 text-sm text-ink-500">Try again, or head back home.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button className="rounded-full bg-moss px-5 py-2.5 font-bold text-white" onClick={() => this.setState({ error: null })}>
                Try again
              </button>
              <a className="rounded-full px-5 py-2.5 font-bold text-brand-800" href="#/home" onClick={() => this.setState({ error: null })}>
                Home
              </a>
            </div>
          </div>
        )
      )
    return this.props.children
  }
}
