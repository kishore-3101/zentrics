import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Zentrics ErrorBoundary caught an exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle = 'Dashboard Component Error', fallbackMessage } = this.props;
      const errorMessage =
        this.state.error?.message || fallbackMessage || 'An unexpected error occurred while rendering this view.';

      return (
        <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-2xl border border-danger/30 bg-card/80 p-8 text-center shadow-panel backdrop-blur-md">
          <div className="grid size-12 place-items-center rounded-2xl border border-danger/40 bg-danger/10 text-danger shadow-inner">
            <AlertOctagon className="size-6" />
          </div>

          <h3 className="mt-4 text-base font-semibold text-ink sm:text-lg">
            {fallbackTitle}
          </h3>

          <p className="mt-1.5 max-w-md text-xs text-muted leading-relaxed">
            Zentrics detected a rendering fault in this module. The application shell and navigation remain fully operational.
          </p>

          <div className="mt-3 max-w-lg rounded-xl border border-danger/25 bg-canvas/80 p-3 text-left font-mono text-xs text-danger/90 overflow-x-auto">
            {errorMessage}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/15 px-4 py-2 text-xs font-semibold text-gold-light hover:bg-gold/25 transition-colors"
            >
              <RefreshCw className="size-3.5" />
              Retry Module
            </button>

            <a
              href="/overview"
              className="inline-flex items-center gap-2 rounded-xl border border-gold/20 bg-card px-4 py-2 text-xs font-medium text-ink hover:bg-white/5 transition-colors"
            >
              <Home className="size-3.5 text-muted" />
              Return to Overview
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
