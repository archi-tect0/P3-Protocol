import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
          <div className="max-w-2xl w-full bg-slate-800 rounded-lg p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <pre className="bg-slate-950 p-4 rounded overflow-auto text-sm mb-4">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <pre className="bg-slate-950 p-4 rounded overflow-auto text-xs text-slate-400">
              {this.state.error?.stack || ''}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
