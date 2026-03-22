// [claude-code 2026-03-22] App-level error boundary — prevents white screen crashes
import { Component, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050402] text-[#f0ead6]">
        <div className="max-w-md text-center space-y-4 p-8">
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#c79f4a]/40 flex items-center justify-center">
            <span className="text-[#c79f4a] text-lg">!</span>
          </div>
          <h2 className="text-lg font-semibold text-[#c79f4a]">Something went wrong</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#c79f4a]/30 text-[#c79f4a] text-sm hover:bg-[#c79f4a]/10 transition-colors"
          >
            <RotateCcw size={14} />
            Reload
          </button>
          <details className="text-left mt-4">
            <summary className="text-[10px] text-zinc-600 cursor-pointer">Stack trace</summary>
            <pre className="mt-2 text-[9px] text-zinc-600 whitespace-pre-wrap overflow-x-auto max-h-32 border border-zinc-800 rounded p-2">
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
