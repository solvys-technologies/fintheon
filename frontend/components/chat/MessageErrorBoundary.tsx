// [claude-code 2026-04-10] S9-T4: Extracted message error boundary from FintheonThread
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class MessageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[MessageErrorBoundary]", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-xs text-red-400/60 italic px-2 py-1">
          Failed to render message
        </div>
      );
    }
    return this.props.children;
  }
}
